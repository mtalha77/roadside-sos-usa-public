import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock("@rsos/db/public", () => ({ createPublicSupabase: () => ({ rpc }) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/site-data", () => ({ getMarkets: async () => [{ slug: "houston" }] }));

const consent = await import("../src/app/api/consent/route");
const market = await import("../src/app/api/market/route");
const waitlist = await import("../src/app/api/waitlist/route");

const post = (
  path: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new NextRequest(`https://site.test${path}`, { method: "POST", body, headers });
};
const cookie = (res: Response, name: string) =>
  decodeURIComponent(
    /=([^;]*)/.exec(res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`)) ?? "")?.[1] ??
      "",
  );

describe("plain form routes (RSOS-028, RSOS-033)", () => {
  beforeEach(() => rpc.mockClear());

  it("consent: accept all, stored with the policy version, then back to the page", async () => {
    const res = await consent.POST(post("/api/consent", { choice: "accept", return: "/faq" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://site.test/faq");
    expect(JSON.parse(decodeURIComponent(cookie(res, "rsos_consent")))).toMatchObject({
      a: true,
      d: true,
      gpc: false,
    });
    expect(rpc).toHaveBeenCalledWith("record_cookie_consent", {
      p: expect.objectContaining({
        analytics: true,
        ads: true,
        policy_version: "2026-11-13-draft",
      }),
    });
  });

  it("consent: Sec-GPC keeps advertising off; other sites are never a return target", async () => {
    const res = await consent.POST(
      post("/api/consent", { choice: "accept", return: "//evil.test/x" }, { "sec-gpc": "1" }),
    );
    expect(res.headers.get("location")).toBe("https://site.test/");
    expect(JSON.parse(decodeURIComponent(cookie(res, "rsos_consent")))).toMatchObject({
      a: true,
      d: false,
      gpc: true,
    });
  });

  it("consent: saved choices from the preferences page", async () => {
    const res = await consent.POST(
      post("/api/consent", { choice: "save", analytics: "on", return: "/" }),
    );
    expect(JSON.parse(decodeURIComponent(cookie(res, "rsos_consent")))).toMatchObject({
      a: true,
      d: false,
    });
  });

  it("market: remembers only real markets", async () => {
    expect(
      cookie(
        await market.POST(post("/api/market", { market: "houston", return: "/get-help" })),
        "rsos_market",
      ),
    ).toBe("houston");
    expect(
      cookie(
        await market.POST(post("/api/market", { market: "atlantis", return: "/" })),
        "rsos_market",
      ),
    ).toBe("");
  });

  it("waitlist: stores a valid email and reports errors back to the page", async () => {
    const ok = await waitlist.POST(
      post("/api/waitlist", {
        email: "a@example.test",
        zip: "75201",
        city: "Dallas",
        region: "tx",
        return: "/",
      }),
    );
    expect(ok.headers.get("location")).toBe("https://site.test/#waitlist");
    expect(cookie(ok, "rsos_waitlist")).toBe("joined");
    expect(rpc).toHaveBeenCalledWith("join_waitlist", {
      p: expect.objectContaining({ email: "a@example.test", zip: "75201", state_code: "TX" }),
    });
    expect(
      cookie(
        await waitlist.POST(post("/api/waitlist", { email: "nope", return: "/" })),
        "rsos_waitlist",
      ),
    ).toBe("email");
  });
});
