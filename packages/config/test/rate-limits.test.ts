import { describe, expect, it } from "vitest";
import { adapterState } from "../src/adapters";
import { DEMO_MULTIPLIER, limitsFor, RATE_LIMITS, rateLimitBackend } from "../src/rate-limits";

const pg = {
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "k",
};
const upstash = { UPSTASH_REDIS_REST_URL: "https://u", UPSTASH_REDIS_REST_TOKEN: "t" };

describe("rate limits config", () => {
  it("limits every endpoint that creates a request, sends email or accepts a form per IP", () => {
    for (const limits of Object.values(RATE_LIMITS)) expect(limits.ip.limit).toBeGreaterThan(0);
    for (const e of ["request", "contact", "apply"] as const) {
      expect(RATE_LIMITS[e].contact.limit).toBeGreaterThan(0);
      expect(RATE_LIMITS[e].market.limit).toBeGreaterThan(0);
    }
  });

  it("uses the production numbers unless the host is in demo mode", () => {
    expect(limitsFor("request", false)).toEqual(RATE_LIMITS.request);
    expect(limitsFor("request", true).ip).toEqual({
      limit: RATE_LIMITS.request.ip.limit * DEMO_MULTIPLIER,
      windowSeconds: RATE_LIMITS.request.ip.windowSeconds,
    });
  });

  it("picks Upstash when configured, else Postgres, else memory", () => {
    expect(rateLimitBackend({ ...pg, ...upstash })).toBe("upstash");
    expect(rateLimitBackend(pg)).toBe("postgres");
    expect(rateLimitBackend({ UPSTASH_REDIS_REST_URL: "https://u", ...pg })).toBe("postgres");
    expect(rateLimitBackend({})).toBe("memory");
  });

  it("reports rate limiting as real in production on Postgres, missing on memory", () => {
    expect(adapterState("rateLimit", { ...pg, NEXT_PUBLIC_SITE_ENV: "production" })).toBe("real");
    expect(adapterState("rateLimit", { NEXT_PUBLIC_SITE_ENV: "production" })).toBe("missing");
  });
});

describe("Sentry status", () => {
  it("is not real from a DSN alone until the SDK is in the apps", () => {
    const env = {
      NEXT_PUBLIC_SENTRY_DSN: "https://k@o1.ingest.sentry.io/1",
      NEXT_PUBLIC_SITE_ENV: "production",
    };
    expect(adapterState("sentry", env)).toBe("missing");
    expect(adapterState("sentry", { ...env, NEXT_PUBLIC_SITE_ENV: "staging" })).toBe("fake");
  });
});
