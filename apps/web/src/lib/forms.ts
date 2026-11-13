import "server-only";
import { checkRateLimits, rateLimitKeys, verifyTurnstile } from "@rsos/core/security";
import { headers } from "next/headers";

/** Caller IP for rate limits and Turnstile (first X-Forwarded-For entry on Vercel). */
export async function callerIp(): Promise<string> {
  return ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
}

/** Rate limit per IP, then Turnstile (fails closed). */
export async function guardForm(
  form: FormData,
  key: string,
  limit: number,
): Promise<"ok" | "limit" | "turnstile"> {
  const ip = await callerIp();
  const rl = await checkRateLimits([
    { key: `${key}:${rateLimitKeys.ip(ip)}`, limit, windowSeconds: 3600 },
  ]);
  if (!rl.allowed) return "limit";
  const token = form.get("cf-turnstile-response");
  const check = await verifyTurnstile(typeof token === "string" ? token : null, { remoteIp: ip });
  return check.ok ? "ok" : "turnstile";
}
