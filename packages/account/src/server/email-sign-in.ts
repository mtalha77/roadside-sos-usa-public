"use server";

import { isDemoMode } from "@rsos/config/demo";
import { checkRateLimits, getRateLimitStore, rateLimitKeys } from "@rsos/core/security";
import { createAdminSupabase } from "@rsos/db/admin";
import { postgresRateLimitStore } from "@rsos/db/usage";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccountSupabase } from "./client";

export type EmailSignInState = {
  email?: string;
  /** Demo hosts only (never production), demo accounts only: the code, shown on screen. */
  demoCode?: string;
  error?: "email" | "limit" | "code" | "generic";
};

const Email = z.email().max(254);
/** Demo accounts use reserved example.com addresses (see demo.ts). */
const isDemoEmail = (email: string) => /^demo-[a-z-]+@example\.com$/.test(email);

/**
 * 3 codes per address per 10 minutes, 10 per IP per hour (Upstash, else Postgres, else memory).
 * Demo-mode hosts (previews, staging) allow more because test suites share one IP.
 */
async function limited(email: string) {
  const [perIp, perEmail] = isDemoMode() ? [200, 100] : [10, 3];
  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const r = await checkRateLimits(
    [
      { key: `signin:${rateLimitKeys.ip(ip)}`, limit: perIp, windowSeconds: 3600 },
      { key: `signin:email:${email}`, limit: perEmail, windowSeconds: 600 },
    ],
    getRateLimitStore(process.env, postgresRateLimitStore()),
  );
  return !r.allowed;
}

/**
 * Step 1: email a 6-digit sign-in code (Supabase Auth email OTP; batch 4 scope change, no SMS).
 * Existing accounts only, and the same answer whether or not the address has one (no probing).
 * On demo hosts a demo account's code is made on the server and shown, since no inbox exists.
 */
export async function sendEmailCodeAction(
  _: EmailSignInState,
  form: FormData,
): Promise<EmailSignInState> {
  const parsed = Email.safeParse(
    String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { error: "email" };
  const email = parsed.data;
  if (await limited(email)) return { error: "limit" };
  if (isDemoMode() && isDemoEmail(email)) {
    const { data } = await createAdminSupabase().auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const code = data?.properties?.email_otp;
    return code ? { email, demoCode: code } : { email };
  }
  const supabase = await getAccountSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  // "Signups not allowed" means no account: answer as if a code was sent.
  if (error && !/signup|not allowed|not found/i.test(error.message)) return { error: "generic" };
  return { email };
}

/** Step 2: check the code; the session is set in cookies and the app's second step follows. */
export async function checkEmailCodeAction(
  prev: EmailSignInState,
  form: FormData,
): Promise<EmailSignInState> {
  const parsed = z
    .object({ email: Email, code: z.string().regex(/^\d{6}$/) })
    .safeParse({ email: form.get("email"), code: String(form.get("code") ?? "").trim() });
  if (!parsed.success) return { ...prev, error: "code" };
  const supabase = await getAccountSupabase();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) return { ...prev, error: "code" };
  redirect("/");
}
