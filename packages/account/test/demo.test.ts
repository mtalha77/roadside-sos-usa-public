import { describe, expect, it, vi } from "vitest";
import { totp } from "../src/server/totp";

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ redirect: () => {} }));
const createAdmin = vi.fn();
vi.mock("@rsos/db/admin", () => ({ createAdminSupabase: createAdmin }));

describe("demo sign-in (batch 3)", () => {
  it("computes authenticator codes like an app does (RFC 6238 test vector)", () => {
    // Secret "12345678901234567890" in base32; at 59 s the 8-digit code is 94287082, 6 digits: 287082.
    expect(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe("287082");
  });

  it("is impossible in production, even with the demo flag set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const { demoSignInAction } = await import("../src/server/demo");
    const form = new FormData();
    form.set("role", "admin_super");
    await expect(demoSignInAction(form)).rejects.toThrow(/not available/);
    expect(createAdmin).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
