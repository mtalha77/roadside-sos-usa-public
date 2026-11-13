import { afterEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ auth: { getClaims } })) }));

const cookies = { getAll: () => [], setAll: () => {} };
afterEach(() => {
  vi.unstubAllEnvs();
  getClaims.mockReset();
});

describe("session claims", () => {
  it("returns null when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { getSessionClaims, supabaseConfigured } = await import("../src/session");
    expect(supabaseConfigured()).toBe(false);
    expect(await getSessionClaims(cookies)).toBeNull();
  });

  it("returns verified claims, or null on error", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { getSessionClaims, supabaseConfigured } = await import("../src/session");
    expect(supabaseConfigured()).toBe(true);
    getClaims.mockResolvedValueOnce({
      data: { claims: { sub: "u1", app_role: "staff", staff_role: "dispatcher", aal: "aal2" } },
      error: null,
    });
    expect((await getSessionClaims(cookies, { httpOnly: true }))?.staff_role).toBe("dispatcher");
    getClaims.mockResolvedValueOnce({ data: null, error: new Error("expired") });
    expect(await getSessionClaims(cookies)).toBeNull();
  });

  it("recognises Supabase auth cookies", async () => {
    const { isAuthCookie } = await import("../src/session");
    expect(isAuthCookie("sb-ref-auth-token")).toBe(true);
    expect(isAuthCookie("NEXT_LOCALE")).toBe(false);
  });
});
