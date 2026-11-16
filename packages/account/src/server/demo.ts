"use server";

import { isDemoMode } from "@rsos/config/demo";
import { demoMarkets, legacyDemoProviderNames } from "@rsos/config/demo-fixtures";
import { createAdminSupabase, demoAccountPassword } from "@rsos/db/admin";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccountSupabase } from "./client";
import { totp } from "./totp";

import { DEMO_ROLES, type DemoRole } from "./demo-roles";

const LABELS: Record<DemoRole, string> = {
  provider_owner: "Demo Owner",
  provider_operator: "Demo Operator",
  admin_super: "Demo Super Admin",
  admin_dispatcher: "Demo Dispatcher",
};

/** Demo accounts use reserved example.com addresses and 555-01xx numbers: nothing real. */
const emailFor = (role: DemoRole) => `demo-${role.replace("_", "-")}@example.com`;
const phoneFor = (role: DemoRole) => (role === "provider_owner" ? "+12105550191" : "+12105550192");

/**
 * "Sign in as demo" (batch 3). Development, previews and staging only: refuses in production
 * (isDemoMode is always false there). Creates the demo account and its company or staff role on
 * first use, signs in, and passes the app's second step on the server.
 */
export async function demoSignInAction(form: FormData): Promise<void> {
  if (!isDemoMode()) throw new Error("Demo sign-in is not available here");
  const role = z.enum(DEMO_ROLES).parse(form.get("role"));
  const admin = createAdminSupabase();
  const email = emailFor(role);
  const password = demoAccountPassword(email);
  const isProvider = role.startsWith("provider");

  // 1. The account (idempotent).
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(isProvider ? { phone: phoneFor(role), phone_confirm: true } : {}),
    user_metadata: { full_name: LABELS[role], demo: true },
  });
  let userId = created.data.user?.id;
  if (!userId) {
    // The account exists already: find it (test runs create many users, so page through them).
    for (let page = 1; page <= 50 && !userId; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      userId = data.users.find((u) => u.email === email)?.id;
      if (data.users.length < 1000) break;
    }
    if (!userId) throw new Error("Demo account could not be created");
  }

  // 2. Its company or staff role, before sign-in (the token hook reads them).
  if (isProvider) {
    const { data: markets } = await admin
      .from("markets")
      .select("id, slug")
      .in("status", ["test", "active"]);
    const first = Object.values(demoMarkets)[0]!.providers[0]!;
    // Find the demo company by its current or a former demo name, and rename it in place.
    let { data: company } = await admin
      .from("providers")
      .select("id, name")
      .eq("is_demo", true)
      .in("name", [first.name, ...legacyDemoProviderNames])
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (company && company.name !== first.name)
      await admin.from("providers").update({ name: first.name }).eq("id", company.id);
    if (!company) {
      const ins = await admin
        .from("providers")
        .insert({
          name: first.name,
          status: "active",
          is_demo: true,
          market_ids: (markets ?? []).map((m) => m.id),
        })
        .select("id, name")
        .single();
      company = ins.data;
    }
    await admin.from("provider_members").upsert({
      user_id: userId,
      provider_id: company!.id,
      role: role === "provider_owner" ? "owner" : "operator",
    });
    await admin
      .from("provider_wallets")
      .upsert(
        { provider_id: company!.id, balance_cents: 18_500 },
        { onConflict: "provider_id", ignoreDuplicates: true },
      );
  } else {
    await admin.from("staff_members").upsert({
      user_id: userId,
      role: role === "admin_super" ? "super_admin" : "dispatcher",
      display_name: LABELS[role],
      is_active: true,
    });
  }

  // 3. Sign in as that account (user session, HttpOnly cookies).
  const supabase = await getAccountSupabase();
  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Reset the password only when it no longer works: a password change signs out every other
    // session of the account, and demo accounts are shared (parallel tests, several people).
    await admin.auth.admin.updateUserById(userId, { password });
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  if (error) throw new Error("Demo sign-in failed");

  // 4. Second step on the server.
  if (isProvider) {
    // Demo accounts are shared: a sign-in happening at the same moment can replace this code
    // (one pending code per account), so retry with a short random pause. A lock caused by such
    // collisions is cleared, since the demo account's code is always known to the server.
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 150 + Math.random() * 450));
      const { data: code, error } = await supabase.rpc("issue_email_code");
      if (error || !code) {
        await admin.from("email_second_step_codes").delete().eq("user_id", userId);
        continue;
      }
      const { data: result } = await supabase.rpc("verify_email_code", { p_code: String(code) });
      if (result === "ok") break;
      if (result === "locked")
        await admin.from("email_second_step_codes").delete().eq("user_id", userId);
    }
  } else {
    const demoTable = admin.from("demo_accounts" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: { totp_secret: string | null } | null }> };
      };
      upsert: (row: object) => Promise<unknown>;
    };
    // Demo accounts are shared. Two sign-ins can set up the authenticator at the same moment, and
    // Supabase accepts each authenticator code only once, so parallel sign-ins in the same 30 s
    // window collide. Reuse the existing authenticator, try the neighbouring codes (one step either
    // side is accepted), and if those are taken too, wait for the next window.
    let passed = false;
    for (let attempt = 0; attempt < 5 && !passed; attempt++) {
      if (attempt > 0) {
        const toNextWindow = 30_000 - (Date.now() % 30_000);
        await new Promise((r) => setTimeout(r, toNextWindow + 200 + Math.random() * 800));
      }
      const { data: row } = await demoTable
        .select("totp_secret")
        .eq("user_id", userId)
        .maybeSingle();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      let factorId = factors?.totp.find((f) => f.status === "verified")?.id;
      let secret = row?.totp_secret ?? null;
      if (!factorId || !secret) {
        for (const f of factors?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
        const enrolled = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `demo-${Date.now()}`,
        });
        if (!enrolled.data) continue;
        secret = enrolled.data.totp.secret;
        factorId = enrolled.data.id;
        await demoTable.upsert({ user_id: userId, role, totp_secret: secret });
      }
      for (const offset of [0, 30_000, -30_000]) {
        const verify = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: totp(secret, Date.now() + offset),
        });
        if (!verify.error) {
          passed = true;
          break;
        }
      }
    }
    if (!passed) throw new Error("Demo second step failed");
  }
  redirect("/");
}
