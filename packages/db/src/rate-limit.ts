import "server-only";
import { isDemoMode } from "@rsos/config/demo";
import type { RateLimitedEndpoint } from "@rsos/config/rate-limits";
import {
  checkRateLimits,
  getRateLimitStore,
  type RateLimitResult,
  type RateLimitStore,
  type RateLimitSubject,
  rulesFor,
} from "@rsos/core/security";
import { postgresRateLimitStore } from "./usage";

/** Caller IP: the first X-Forwarded-For entry (set by Vercel), else "unknown". */
export function callerIpFrom(headers: Pick<Headers, "get">): string {
  return (headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim() || "unknown";
}

/**
 * The store every public endpoint uses: Upstash when its keys are set (no code change needed),
 * else the Postgres counter shared by every server instance, else memory if Postgres fails.
 */
export function sharedRateLimitStore(): RateLimitStore {
  return getRateLimitStore(process.env, postgresRateLimitStore());
}

/**
 * Checks an endpoint's limits (per IP, per email or phone, per market; numbers in
 * `@rsos/config/rate-limits`) and counts this call.
 */
export function enforceRateLimit(
  endpoint: RateLimitedEndpoint,
  subject: RateLimitSubject,
  store: RateLimitStore = sharedRateLimitStore(),
): Promise<RateLimitResult> {
  return checkRateLimits(rulesFor(endpoint, subject, isDemoMode()), store);
}
