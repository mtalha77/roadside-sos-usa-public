import { afterEach, describe, expect, it, vi } from "vitest";

const hits = new Map<string, number>();
const rpc = vi.fn(async (_fn: string, args: { p_key: string }) => {
  const n = (hits.get(args.p_key) ?? 0) + 1;
  hits.set(args.p_key, n);
  return { data: n, error: null };
});
vi.mock("../src/public", () => ({ createPublicSupabase: () => ({ rpc }) }));

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  hits.clear();
  rpc.mockClear();
});

describe("enforceRateLimit", () => {
  it("counts every scope on the shared Postgres counter and blocks over the limit", async () => {
    process.env.NEXT_PUBLIC_SITE_ENV = "production";
    const { enforceRateLimit } = await import("../src/rate-limit");
    const subject = { ip: "1.2.3.4", markets: ["test-m"] };
    for (let i = 0; i < 3; i++)
      expect((await enforceRateLimit("apply", subject)).allowed).toBe(true);
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", {
      p_key: "rl:apply:market:test-m",
      p_window_seconds: 3600,
    });
    // apply allows 3 per IP an hour; the 4th from that IP is refused.
    expect(await enforceRateLimit("apply", { ...subject, email: "new@example.com" })).toMatchObject(
      {
        allowed: false,
        key: "apply:ip:1.2.3.4",
      },
    );
  });

  it("reads the caller IP from X-Forwarded-For", async () => {
    const { callerIpFrom } = await import("../src/rate-limit");
    expect(callerIpFrom(new Headers({ "x-forwarded-for": " 9.9.9.9 , 10.0.0.1" }))).toBe("9.9.9.9");
    expect(callerIpFrom(new Headers())).toBe("unknown");
  });
});
