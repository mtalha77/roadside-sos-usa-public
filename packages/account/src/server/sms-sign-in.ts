"use server";

import { getSiteEnv } from "@rsos/config/site";
import { chooseVerify, verifyAvailable } from "@rsos/core/adapters";
import { checkRateLimits, getRateLimitStore, rateLimitKeys } from "@rsos/core/security";
import { createAdminSupabase } from "@rsos/db/admin";
import { postgresRateLimitStore, recordUsage } from "@rsos/db/usage";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAccountSupabase } from "./client";

export type SmsSignInState = {
  phone?: string;
  /** Outside production with no Twilio keys: the fake's code, shown on screen. */
  demoCode?: string;
  error?: "phone" | "limit" | "code" | "unavailable" | "noAccount" | "generic";
};

const toE164 = (raw: unknown) => {
  const d = String(raw ?? "")
    .replace(/\D/g, "")
    .replace(/^1(?=\d{10}$)/, "");
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? `+1${d}` : null;
};

/** 3 codes per phone per 10 minutes, 10 per IP per hour (Upstash, else Postgres, else memory). */
async function limited(phone: string) {
  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const r = await checkRateLimits(
    [
      { key: `signin:${rateLimitKeys.ip(ip)}`, limit: 10, windowSeconds: 3600 },
      { key: `signin:${rateLimitKeys.phone(phone)}`, limit: 3, windowSeconds: 600 },
    ],
    getRateLimitStore(process.env, postgresRateLimitStore()),
  );
  return !r.allowed;
}

/** Step 1: text a sign-in code (Twilio Verify; the fake outside production without keys). */
export async function sendSignInCodeAction(
  _: SmsSignInState,
  form: FormData,
): Promise<SmsSignInState> {
  const phone = toE164(form.get("phone"));
  if (!phone) return { error: "phone" };
  const verify = chooseVerify();
  if (!verifyAvailable(verify)) return { error: "unavailable" };
  if (await limited(phone)) return { error: "limit" };
  // Same answer whether or not an account uses the number (no account probing).
  const started = await verify.start(phone);
  if (!started.ok) return { error: started.reason === "invalid-phone" ? "phone" : "generic" };
  if (verify.mode === "real") await recordUsage("twilio_verify").catch(() => null);
  return { phone, ...(started.demoCode ? { demoCode: started.demoCode } : {}) };
}

/** Step 2: check the code, find the account for that phone and start its session. */
export async function checkSignInCodeAction(
  prev: SmsSignInState,
  form: FormData,
): Promise<SmsSignInState> {
  const parsed = z
    .object({ phone: z.string(), code: z.string().regex(/^\d{6}$/) })
    .safeParse({ phone: toE164(form.get("phone")), code: form.get("code") });
  if (!parsed.success) return { ...prev, error: "code" };
  const verify = chooseVerify();
  if (!verifyAvailable(verify)) return { error: "unavailable" };
  const checked = await verify.check(parsed.data.phone, parsed.data.code);
  if (!checked.ok) return { ...prev, error: checked.reason === "error" ? "generic" : "code" };

  const admin = createAdminSupabase();
  const { data } = await admin.rpc("auth_user_for_phone", { p_phone: parsed.data.phone });
  const account = Array.isArray(data) ? data[0] : null;
  // The fake verifier (fixed code, no Twilio keys) may only open demo accounts.
  if (
    !account ||
    (verify.mode === "fake" && !account.is_demo) ||
    (getSiteEnv() === "production" && verify.mode !== "real")
  )
    return { ...prev, error: "noAccount" };

  // A one-time sign-in token for that account, exchanged here for a session (cookies).
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: account.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) return { ...prev, error: "generic" };
  const supabase = await getAccountSupabase();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (otpError) return { ...prev, error: "generic" };
  redirect("/");
}
