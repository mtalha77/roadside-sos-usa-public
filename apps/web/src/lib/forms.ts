import "server-only";
import type { RateLimitedEndpoint } from "@rsos/config/rate-limits";
import { type RateLimitSubject, verifyTurnstile } from "@rsos/core/security";
import { callerIpFrom, enforceRateLimit } from "@rsos/db/rate-limit";
import { headers } from "next/headers";

/** Caller IP for rate limits and Turnstile (first X-Forwarded-For entry on Vercel). */
export async function callerIp(): Promise<string> {
  return callerIpFrom(await headers());
}

/**
 * Rate limits (per IP, per email or phone, per market; shared Postgres counter), then Turnstile
 * (fails closed).
 */
export async function guardForm(
  form: FormData,
  endpoint: RateLimitedEndpoint,
  subject: Omit<RateLimitSubject, "ip">,
): Promise<"ok" | "limit" | "turnstile"> {
  const ip = await callerIp();
  const rl = await enforceRateLimit(endpoint, { ...subject, ip });
  if (!rl.allowed) return "limit";
  const token = form.get("cf-turnstile-response");
  const check = await verifyTurnstile(typeof token === "string" ? token : null, { remoteIp: ip });
  return check.ok ? "ok" : "turnstile";
}
