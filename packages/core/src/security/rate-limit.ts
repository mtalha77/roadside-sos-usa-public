/**
 * Fixed-window rate limiting per key (IP address, phone number, ...).
 * Uses Upstash Redis over REST when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
 * set; otherwise falls back to an in-memory store (per server instance) so limits still
 * apply, more loosely, until Upstash is configured.
 */
export interface RateLimitStore {
  /** Increments the counter for `key` and returns the new count; the window starts on first hit. */
  increment(key: string, windowSeconds: number): Promise<number>;
}

export type RateLimitRule = { key: string; limit: number; windowSeconds: number };
export type RateLimitResult =
  { allowed: true } | { allowed: false; key: string; retryAfterSeconds: number };

export function createMemoryStore(now: () => number = Date.now): RateLimitStore {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    async increment(key, windowSeconds) {
      const t = now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        hits.set(key, { count: 1, resetAt: t + windowSeconds * 1000 });
        return 1;
      }
      entry.count += 1;
      return entry.count;
    },
  };
}

export function createUpstashStore(
  url: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): RateLimitStore {
  return {
    async increment(key, windowSeconds) {
      const res = await fetchImpl(`${url.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, String(windowSeconds), "NX"],
        ]),
      });
      if (!res.ok) throw new Error(`Upstash error ${res.status}`);
      const data = (await res.json()) as { result?: unknown }[];
      const count = Number(data[0]?.result);
      if (!Number.isFinite(count)) throw new Error("Unexpected Upstash response");
      return count;
    },
  };
}

let defaultStore: RateLimitStore | undefined;

/** Upstash when configured, otherwise the in-memory fallback. */
export function getRateLimitStore(
  env: Record<string, string | undefined> = process.env,
): RateLimitStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return createUpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  }
  defaultStore ??= createMemoryStore();
  return defaultStore;
}

/** Checks every rule (e.g. per IP and per phone); the first one over its limit wins. */
export async function checkRateLimits(
  rules: RateLimitRule[],
  store: RateLimitStore = getRateLimitStore(),
): Promise<RateLimitResult> {
  for (const rule of rules) {
    const count = await store.increment(`rl:${rule.key}`, rule.windowSeconds);
    if (count > rule.limit)
      return { allowed: false, key: rule.key, retryAfterSeconds: rule.windowSeconds };
  }
  return { allowed: true };
}

/** 429 response for a request over its limit, or null when allowed. */
export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.allowed) return null;
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSeconds),
    },
  });
}

/** Standard keys so the same limits apply everywhere. */
export const rateLimitKeys = {
  ip: (ip: string) => `ip:${ip}`,
  phone: (e164: string) => `phone:${e164}`,
};
