import { limitsFor, type RateLimitedEndpoint, type RateLimitScope } from "@rsos/config/rate-limits";

/**
 * Fixed-window rate limiting per key (IP address, phone number, ...).
 * Uses Upstash Redis over REST when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
 * set; otherwise a Postgres counter (`rate_limit_hit`, RSOS-021b) shared by every instance;
 * otherwise an in-memory store (per server instance).
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

/** Uses `primary`, and the in-memory store if it fails (a limiter outage never blocks drivers). */
export function withMemoryFallback(primary: RateLimitStore): RateLimitStore {
  return {
    async increment(key, windowSeconds) {
      try {
        return await primary.increment(key, windowSeconds);
      } catch {
        defaultStore ??= createMemoryStore();
        return defaultStore.increment(key, windowSeconds);
      }
    },
  };
}

/**
 * Upstash when configured; otherwise the durable store passed in (Postgres, shared by every
 * server instance); otherwise the in-memory fallback.
 */
export function getRateLimitStore(
  env: Record<string, string | undefined> = process.env,
  durable?: RateLimitStore | null,
): RateLimitStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return createUpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  }
  if (durable) return withMemoryFallback(durable);
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
  email: (email: string) => `email:${email.trim().toLowerCase()}`,
  market: (slug: string) => `market:${slug}`,
};

/** Who is calling: the IP, the email or phone typed in, and the market(s) it is for. */
export type RateLimitSubject = {
  ip: string;
  email?: string | null;
  phone?: string | null;
  markets?: readonly (string | null | undefined)[];
};

/**
 * The rules for one endpoint from the limits in `@rsos/config/rate-limits`: per IP, per contact
 * (every email and phone given) and per market (every market given). Scopes the endpoint does not
 * limit, or the subject does not have, are skipped.
 */
export function rulesFor(
  endpoint: RateLimitedEndpoint,
  subject: RateLimitSubject,
  demo: boolean,
): RateLimitRule[] {
  const limits = limitsFor(endpoint, demo);
  const keys: Record<RateLimitScope, string[]> = {
    ip: [rateLimitKeys.ip(subject.ip || "unknown")],
    contact: [
      ...(subject.email ? [rateLimitKeys.email(subject.email)] : []),
      ...(subject.phone ? [rateLimitKeys.phone(subject.phone)] : []),
    ],
    market: [...new Set((subject.markets ?? []).filter((m): m is string => !!m))].map(
      rateLimitKeys.market,
    ),
  };
  return (Object.keys(keys) as RateLimitScope[]).flatMap((scope) => {
    const w = limits[scope];
    if (!w) return [];
    return keys[scope].map((k) => ({ key: `${endpoint}:${k}`, ...w }));
  });
}
