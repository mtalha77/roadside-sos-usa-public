import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Twilio adapter (batch 4). Screens and server code use these interfaces, never the Twilio SDK.
 * Real implementations call the REST API with fetch; fakes send nothing and are used in tests,
 * local development, previews, staging without keys and demo mode.
 */

const E164 = z.string().regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/);
type Env = Record<string, string | undefined>;

// ---------------------------------------------------------------------------------------------
// Verify: SMS codes for driver phone checks and provider/admin sign-in
// ---------------------------------------------------------------------------------------------
export type VerifyStart =
  { ok: true; demoCode?: string } | { ok: false; reason: "invalid-phone" | "error" };
export type VerifyCheck = { ok: true } | { ok: false; reason: "invalid-code" | "error" };

export interface VerifyAdapter {
  readonly mode: "real" | "fake";
  start(phone: string): Promise<VerifyStart>;
  check(phone: string, code: string): Promise<VerifyCheck>;
}

/** The fake's fixed code (shown on screen outside production; nothing is sent). */
export const FAKE_VERIFY_CODE = "000000";

export function createFakeVerify(): VerifyAdapter {
  return {
    mode: "fake",
    async start(phone) {
      if (!E164.safeParse(phone).success) return { ok: false, reason: "invalid-phone" };
      return { ok: true, demoCode: FAKE_VERIFY_CODE };
    },
    async check(phone, code) {
      if (!E164.safeParse(phone).success) return { ok: false, reason: "error" };
      return code === FAKE_VERIFY_CODE ? { ok: true } : { ok: false, reason: "invalid-code" };
    },
  };
}

const VerifyResponse = z.object({ status: z.string() });

export function createTwilioVerify(
  creds: { accountSid: string; authToken: string; serviceSid: string },
  fetchImpl: typeof fetch = fetch,
): VerifyAdapter {
  const base = `https://verify.twilio.com/v2/Services/${creds.serviceSid}`;
  const auth = `Basic ${btoa(`${creds.accountSid}:${creds.authToken}`)}`;
  const post = (path: string, body: Record<string, string>) =>
    fetchImpl(`${base}/${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(8000),
    });
  return {
    mode: "real",
    async start(phone) {
      if (!E164.safeParse(phone).success) return { ok: false, reason: "invalid-phone" };
      try {
        const res = await post("Verifications", { To: phone, Channel: "sms" });
        return res.ok ? { ok: true } : { ok: false, reason: "error" };
      } catch {
        return { ok: false, reason: "error" };
      }
    },
    async check(phone, code) {
      if (!E164.safeParse(phone).success || !/^\d{4,10}$/.test(code))
        return { ok: false, reason: "invalid-code" };
      try {
        const res = await post("VerificationCheck", { To: phone, Code: code });
        // Twilio answers 404 when the verification expired or was already approved.
        if (res.status === 404) return { ok: false, reason: "invalid-code" };
        if (!res.ok) return { ok: false, reason: "error" };
        const parsed = VerifyResponse.safeParse(await res.json());
        if (!parsed.success) return { ok: false, reason: "error" };
        return parsed.data.status === "approved"
          ? { ok: true }
          : { ok: false, reason: "invalid-code" };
      } catch {
        return { ok: false, reason: "error" };
      }
    },
  };
}

/** Real Verify when its keys are set; otherwise the fake (never in production: see `verifyAvailable`). */
export function chooseVerify(env: Env = process.env): VerifyAdapter {
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VERIFY_SERVICE_SID)
    return createTwilioVerify({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      serviceSid: env.TWILIO_VERIFY_SERVICE_SID,
    });
  return createFakeVerify();
}

/** Production never falls back to the fake: without keys, SMS codes are simply unavailable. */
export function verifyAvailable(adapter: VerifyAdapter, env: Env = process.env): boolean {
  return adapter.mode === "real" || (env.NEXT_PUBLIC_SITE_ENV ?? "development") !== "production";
}

// ---------------------------------------------------------------------------------------------
// Webhook signatures (X-Twilio-Signature)
// ---------------------------------------------------------------------------------------------

/**
 * Twilio's request signature: HMAC-SHA1 (auth token) of the full URL followed by every POST
 * parameter name and value, sorted by name, base64-encoded.
 */
export function twilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

/** Constant-time check of X-Twilio-Signature. False for a missing signature or token. */
export function validateTwilioSignature(
  authToken: string | undefined,
  url: string,
  params: Record<string, string>,
  signature: string | null | undefined,
): boolean {
  if (!authToken || !signature) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
