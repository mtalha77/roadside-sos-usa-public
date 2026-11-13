import { afterEach, describe, expect, it, vi } from "vitest";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

afterEach(() => vi.unstubAllEnvs());

function stubEnv(values: Record<string, string>) {
  for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
}

describe("Supabase clients", () => {
  it("browser client is created from validated public env", async () => {
    stubEnv(env);
    const { createBrowserSupabase } = await import("../src/index");
    const client = createBrowserSupabase();
    expect(typeof client.from).toBe("function");
  });

  it("browser client refuses to start without env", async () => {
    stubEnv({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" });
    const { createBrowserSupabase } = await import("../src/index");
    expect(() => createBrowserSupabase()).toThrow();
  });

  it("server client uses the cookie methods it is given, with optional strict cookies", async () => {
    stubEnv(env);
    const { createServerSupabase, strictCookieOptions } = await import("../src/server");
    const getAll = vi.fn(() => []);
    const client = createServerSupabase({ getAll, setAll: vi.fn() }, strictCookieOptions);
    expect(typeof client.auth.getSession).toBe("function");
    await client.auth.getSession();
    expect(getAll).toHaveBeenCalled();
    expect(strictCookieOptions).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
    expect(typeof createServerSupabase({ getAll, setAll: vi.fn() }).from).toBe("function");
  });

  it("admin client needs the service role key", async () => {
    stubEnv(env);
    const { createAdminSupabase } = await import("../src/admin");
    expect(() => createAdminSupabase()).toThrow();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
    expect(typeof createAdminSupabase().from).toBe("function");
  });
});
