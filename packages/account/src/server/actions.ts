"use server";

import { randomBytes } from "node:crypto";
import { chooseEmailSender, SignInCodeEmail, signInCodeSubject } from "@rsos/emails";
import { LOCALE_COOKIE, resolveLocale } from "@rsos/i18n";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccountSupabase, requestMeta, TRUSTED_DEVICE_COOKIE } from "./client";
import { recordSecurityEvent } from "./notify";

export type ActionState = {
  ok?: boolean;
  error?: "required" | "invalid" | "code" | "locked" | "expired" | "generic" | "reauth";
  mockCode?: string;
  codes?: string[];
};

const Password = z.string().min(12).max(200);
/** This app's own origin (provider or admin), for links in emails. */
async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const safeNext = (v: FormDataEntryValue | null) =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/";

/** Emails a fresh 6-digit code. In development and previews the code is also returned (mock sender). */
export async function sendSecondStepCodeAction(): Promise<ActionState> {
  const supabase = await getAccountSupabase();
  const { data: code, error } = await supabase.rpc("issue_email_code");
  if (error)
    return {
      error: error.hint === "locked" || /locked/.test(error.message) ? "locked" : "generic",
    };
  const { data } = await supabase.auth.getUser();
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const sender = chooseEmailSender();
  if (data.user?.email) {
    await sender.send({
      to: data.user.email,
      subject: signInCodeSubject(locale),
      react: SignInCodeEmail({ code: String(code), locale }),
      tags: { category: "sign-in-code" },
    });
  }
  return sender.mode === "mock" ? { ok: true, mockCode: String(code) } : { ok: true };
}

/** Checks the emailed code; optionally trusts this device for 30 days. */
export async function verifySecondStepAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z
    .object({ code: z.string().regex(/^\d{6}$/) })
    .safeParse({ code: form.get("code") });
  if (!parsed.success) return { error: "code" };
  const supabase = await getAccountSupabase();
  const { data: result } = await supabase.rpc("verify_email_code", { p_code: parsed.data.code });
  if (result === "locked") return { error: "locked" };
  if (result === "expired") return { error: "expired" };
  if (result !== "ok") return { error: "code" };
  if (form.get("trust") === "on") {
    const token = randomBytes(32).toString("base64url");
    const { userAgent } = await requestMeta();
    const { error } = await supabase.rpc("trust_this_device", {
      p_token: token,
      p_user_agent: userAgent,
    });
    if (!error)
      (await cookies()).set(TRUSTED_DEVICE_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 3600,
      });
  }
  await recordSecurityEvent(supabase, "new_sign_in");
  redirect(safeNext(form.get("next")));
}

/** Uses a trusted-device cookie, if valid, to pass the second step without a code. */
export async function tryTrustedDevice(): Promise<boolean> {
  const token = (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value;
  if (!token) return false;
  const supabase = await getAccountSupabase();
  const { data } = await supabase.rpc("use_trusted_device", { p_token: token });
  return data === true;
}

export async function useRecoveryCodeAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.string().min(6).max(20).safeParse(form.get("recovery"));
  if (!parsed.success) return { error: "required" };
  const supabase = await getAccountSupabase();
  const { data } = await supabase.rpc("use_recovery_code", { p_code: parsed.data });
  if (data !== true) return { error: "code" };
  await recordSecurityEvent(supabase, "new_sign_in");
  redirect(safeNext(form.get("next")));
}

export async function updateNameAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.string().trim().min(1).max(120).safeParse(form.get("name"));
  if (!parsed.success) return { error: "required" };
  const supabase = await getAccountSupabase();
  const { error } = await supabase.auth.updateUser({ data: { full_name: parsed.data } });
  if (error) return { error: "generic" };
  const { ip } = await requestMeta();
  await supabase.rpc("log_security_event", { p_action: "auth.name_changed", p_ip: ip ?? "" });
  return { ok: true };
}

/** Email change: Supabase sends confirmation links to the current and the new address (secure email change). */
export async function changeEmailAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "required" };
  const supabase = await getAccountSupabase();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo: `${await origin()}/account` },
  );
  if (error) return { error: "generic" };
  await recordSecurityEvent(supabase, "email_changed");
  return { ok: true };
}

/** Password change: checks the current password with a throwaway session first. */
export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z
    .object({ current: z.string().min(1), next: Password })
    .safeParse({ current: form.get("current"), next: form.get("next") });
  if (!parsed.success) return { error: "required" };
  const supabase = await getAccountSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return { error: "generic" };
  const probe = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const check = await probe.auth.signInWithPassword({
    email: data.user.email,
    password: parsed.data.current,
  });
  if (check.error) return { error: "invalid" };
  await probe.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) return { error: /reauth/i.test(error.message) ? "reauth" : "generic" };
  await recordSecurityEvent(supabase, "password_changed");
  return { ok: true };
}

export async function setSecondStepMethodAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = z.enum(["email", "sms", "totp"]).safeParse(form.get("method"));
  if (!parsed.success) return { error: "required" };
  const supabase = await getAccountSupabase();
  const { error } = await supabase.rpc("set_second_step_method", { p_method: parsed.data });
  if (error) return { error: "generic" };
  await recordSecurityEvent(supabase, "second_step_changed", { alreadyAudited: true });
  return { ok: true };
}

export async function generateRecoveryCodesAction(): Promise<ActionState> {
  const supabase = await getAccountSupabase();
  const { data, error } = await supabase.rpc("generate_recovery_codes");
  if (error) return { error: "generic" };
  await recordSecurityEvent(supabase, "recovery_codes", { alreadyAudited: true });
  return { ok: true, codes: (data as unknown as string[]) ?? [] };
}

export async function revokeSessionAction(form: FormData): Promise<void> {
  const id = z.uuid().safeParse(form.get("session"));
  if (!id.success) return;
  const supabase = await getAccountSupabase();
  const { data } = await supabase.rpc("revoke_my_session", { p_session_id: id.data });
  if (data === true)
    await recordSecurityEvent(supabase, "session_revoked", { alreadyAudited: true });
}

export async function forgetDeviceAction(form: FormData): Promise<void> {
  const id = z.uuid().safeParse(form.get("device"));
  if (!id.success) return;
  await (await getAccountSupabase()).rpc("forget_trusted_device", { p_id: id.data });
}

export async function requestClosureAction(_: ActionState, form: FormData): Promise<ActionState> {
  const reason = z
    .string()
    .max(2000)
    .safeParse(form.get("reason") ?? "");
  const supabase = await getAccountSupabase();
  const { error } = await supabase.rpc("request_account_closure", {
    p_reason: reason.success ? reason.data : "",
  });
  if (error) return { error: "generic" };
  await recordSecurityEvent(supabase, "closure_requested", { alreadyAudited: true });
  return { ok: true };
}

/** Same answer whether or not the account exists (no account probing). */
export async function forgotPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "required" };
  const supabase = await getAccountSupabase();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  return { ok: true };
}

export async function resetPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = Password.safeParse(form.get("next"));
  if (!parsed.success) return { error: "required" };
  const supabase = await getAccountSupabase();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: "generic" };
  await recordSecurityEvent(supabase, "password_changed");
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

export async function signOutEverywhereElseAction(): Promise<void> {
  await (await getAccountSupabase()).auth.signOut({ scope: "others" });
}

/** Starts authenticator-app setup: removes unfinished setups, returns the QR code and key. */
export async function startTotpEnrollAction(): Promise<
  { factorId: string; qr: string; secret: string } | { error: "generic" }
> {
  const supabase = await getAccountSupabase();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified")
      await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) return { error: "generic" };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirms a new authenticator with its first code and makes it the second step. */
export async function confirmTotpEnrollAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({ factorId: z.string().min(1), code: z.string().regex(/^\d{6}$/) })
    .safeParse({ factorId: form.get("factorId"), code: form.get("code") });
  if (!parsed.success) return { error: "code" };
  const supabase = await getAccountSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) return { error: "code" };
  await supabase.rpc("set_second_step_method", { p_method: "totp" });
  await recordSecurityEvent(supabase, "second_step_changed", { alreadyAudited: true });
  return { ok: true };
}

/** Second step with the authenticator app (providers who chose it). */
export async function verifyTotpSecondStepAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = z
    .string()
    .regex(/^\d{6}$/)
    .safeParse(form.get("code"));
  if (!parsed.success) return { error: "code" };
  const supabase = await getAccountSupabase();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) return { error: "generic" };
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data,
  });
  if (error) return { error: "code" };
  await supabase.rpc("mark_session_verified", { p_method: "totp" });
  await recordSecurityEvent(supabase, "new_sign_in");
  redirect(safeNext(form.get("next")));
}
