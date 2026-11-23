import { describe, expect, it, vi } from "vitest";
import {
  checkRateLimits,
  createMemoryStore,
  rateLimitKeys,
  rateLimitResponse,
  verifyTurnstile,
} from "../src/security";

function mockFetch(body: unknown, status = 200) {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe("verifyTurnstile", () => {
  it("rejects a form submit without a token", async () => {
    expect(
      await verifyTurnstile(undefined, { secret: "s", fetchImpl: mockFetch({ success: true }) }),
    ).toEqual({
      ok: false,
      reason: "missing-token",
    });
  });

  it("rejects a token that Cloudflare says is invalid", async () => {
    const fetchImpl = mockFetch({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await verifyTurnstile("bad-token", { secret: "s", fetchImpl })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("accepts a valid token", async () => {
    expect(
      await verifyTurnstile("good", { secret: "s", fetchImpl: mockFetch({ success: true }) }),
    ).toEqual({ ok: true });
  });

  it("fails closed when not configured or Cloudflare is down", async () => {
    expect(await verifyTurnstile("t", { secret: "" })).toEqual({
      ok: false,
      reason: "not-configured",
    });
    const down = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile("t", { secret: "s", fetchImpl: down })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After once a key is over its limit", async () => {
    const store = createMemoryStore(() => 1_000);
    const rules = [{ key: rateLimitKeys.ip("203.0.113.7"), limit: 2, windowSeconds: 60 }];
    expect(rateLimitResponse(await checkRateLimits(rules, store))).toBeNull();
    expect(rateLimitResponse(await checkRateLimits(rules, store))).toBeNull();
    const blocked = rateLimitResponse(await checkRateLimits(rules, store));
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("60");
  });

  it("limits per phone independently of IP", async () => {
    const store = createMemoryStore(() => 1_000);
    const phone = { key: rateLimitKeys.phone("+15555550100"), limit: 1, windowSeconds: 600 };
    await checkRateLimits(
      [{ key: rateLimitKeys.ip("a"), limit: 10, windowSeconds: 60 }, phone],
      store,
    );
    const second = await checkRateLimits(
      [{ key: rateLimitKeys.ip("b"), limit: 10, windowSeconds: 60 }, phone],
      store,
    );
    expect(second).toEqual({ allowed: false, key: "phone:+15555550100", retryAfterSeconds: 600 });
  });

  it("resets after the window", async () => {
    let t = 0;
    const store = createMemoryStore(() => t);
    const rule = [{ key: "ip:x", limit: 1, windowSeconds: 1 }];
    await checkRateLimits(rule, store);
    expect((await checkRateLimits(rule, store)).allowed).toBe(false);
    t = 2_000;
    expect((await checkRateLimits(rule, store)).allowed).toBe(true);
  });
});

describe("Upstash store", () => {
  it("increments with INCR and EXPIRE NX in one pipeline", async () => {
    const { createUpstashStore } = await import("../src/security");
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify([{ result: 3 }, { result: 1 }])),
    ) as unknown as typeof fetch;
    const store = createUpstashStore("https://redis.test/", "token", fetchImpl);
    expect(await store.increment("rl:ip:x", 60)).toBe(3);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://redis.test/pipeline");
    expect(JSON.parse(String(init.body))).toEqual([
      ["INCR", "rl:ip:x"],
      ["EXPIRE", "rl:ip:x", "60", "NX"],
    ]);
  });

  it("throws on Upstash errors so callers can decide", async () => {
    const { createUpstashStore } = await import("../src/security");
    const failing = vi.fn(
      async () => new Response("no", { status: 500 }),
    ) as unknown as typeof fetch;
    await expect(
      createUpstashStore("https://redis.test", "t", failing).increment("k", 1),
    ).rejects.toThrow();
    const odd = vi.fn(async () => new Response(JSON.stringify([{}]))) as unknown as typeof fetch;
    await expect(
      createUpstashStore("https://redis.test", "t", odd).increment("k", 1),
    ).rejects.toThrow();
  });

  it("picks Upstash when configured, memory otherwise", async () => {
    const { getRateLimitStore } = await import("../src/security");
    const memory = getRateLimitStore({});
    expect(getRateLimitStore({})).toBe(memory);
    expect(
      getRateLimitStore({
        UPSTASH_REDIS_REST_URL: "https://r.test",
        UPSTASH_REDIS_REST_TOKEN: "t",
      }),
    ).not.toBe(memory);
  });

  it("turnstile reports unavailable on HTTP and schema errors", async () => {
    const { verifyTurnstile } = await import("../src/security");
    const http = vi.fn(async () => new Response("x", { status: 503 })) as unknown as typeof fetch;
    expect(
      await verifyTurnstile("t", { secret: "s", fetchImpl: http, remoteIp: "203.0.113.1" }),
    ).toEqual({ ok: false, reason: "unavailable" });
    const bad = vi.fn(
      async () => new Response(JSON.stringify({ nope: true })),
    ) as unknown as typeof fetch;
    expect(await verifyTurnstile("t", { secret: "s", fetchImpl: bad })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});
