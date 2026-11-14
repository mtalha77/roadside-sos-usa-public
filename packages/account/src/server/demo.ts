"use server";

import { isDemoMode } from "@rsos/config/demo";
import { demoMarkets } from "@rsos/config/demo-fixtures";
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
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = data.users.find((u) => u.email === email)?.id;
    if (!userId) throw new Error("Demo account could not be created");
    await admin.auth.admin.updateUserById(userId, { password });
  }

  // 2. Its company or staff role, before sign-in (the token hook reads them).
  if (isProvider) {
    const { data: markets } = await admin
      .from("markets")
      .select("id, slug")
      .in("status", ["test", "active"]);
    const first = Object.values(demoMarkets)[0]!.providers[0]!;
    let { data: company } = await admin
      .from("providers")
      .select("id")
      .eq("name", first.name)
      .maybeSingle();
    if (!company) {
      const ins = await admin
        .from("providers")
        .insert({
          name: first.name,
          status: "active",
          market_ids: (markets ?? []).map((m) => m.id),
        })
        .select("id")
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Demo sign-in failed");

  // 4. Second step on the server.
  if (isProvider) {
    const { data: code } = await supabase.rpc("issue_email_code");
    await supabase.rpc("verify_email_code", { p_code: String(code) });
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
    const { data: row } = await demoTable.select("totp_secret").eq("user_id", userId).maybeSingle();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    let factor = factors?.totp.find((f) => f.status === "verified");
    let secret = row?.totp_secret ?? null;
    if (!factor || !secret) {
      for (const f of factors?.all ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "demo" });
      if (!enrolled.data) throw new Error("Demo authenticator setup failed");
      secret = enrolled.data.totp.secret;
      await demoTable.upsert({ user_id: userId, role, totp_secret: secret });
      factor = { id: enrolled.data.id } as typeof factor;
    }
    const verify = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor!.id,
      code: totp(secret),
    });
    if (verify.error) throw new Error("Demo second step failed");
  }
  redirect("/");
}
