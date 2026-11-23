import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: (fn: unknown) => fn }));
vi.mock("server-only", () => ({}));
const { POST } = await import("../src/app/api/revalidate/route");

const call = (auth?: string) =>
  POST(
    new NextRequest("https://site.test/api/revalidate", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );

describe("revalidate endpoint (RSOS-024: pages refresh when market data changes)", () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    process.env.REVALIDATE_SECRET = "s".repeat(64);
  });

  it("refreshes the site data with the right secret", async () => {
    const res = await call(`Bearer ${"s".repeat(64)}`);
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("site-data", "max");
  });

  it("refuses a missing or wrong secret, or no configured secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    delete process.env.REVALIDATE_SECRET;
    expect((await call("Bearer ")).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
