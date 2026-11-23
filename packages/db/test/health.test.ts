import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fake clients: no network. The public client answers the database probe; the admin client the
// demo sign-in probe.
const probe = vi.fn();
const listUsers = vi.fn();
vi.mock("../src/public", () => ({
  createPublicSupabase: () =>
    process.env.NEXT_PUBLIC_SUPABASE_URL ? { rpc: () => probe() } : null,
}));
vi.mock("../src/admin", () => ({
  createAdminSupabase: () => ({ auth: { admin: { listUsers } } }),
}));

const ref = "abcdefghijklmnopqrst";
const jwt = (claims: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const saved = { ...process.env };

beforeEach(() => {
  probe.mockResolvedValue({ error: null });
  listUsers.mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${ref}.supabase.co`;
  process.env.NEXT_PUBLIC_SITE_ENV = "staging";
  process.env.NEXT_PUBLIC_DEMO_MODE = "true";
  process.env.VERCEL_GIT_COMMIT_SHA = "abc1234";
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: "service_role", ref });
});
afterEach(() => {
  process.env = { ...saved };
});

describe("getHealth", () => {
  it("is green with a matching key, a reachable database and demo sign-in", async () => {
    const { getHealth } = await import("../src/health");
    const h = await getHealth("admin");
    expect(h).toMatchObject({
      ok: true,
      app: "admin",
      environment: "staging",
      commit: "abc1234",
      demoMode: true,
      database: "ok",
      serviceKey: "match",
      demoSignIn: "ok",
    });
    expect(h.adapters.twilio).toBe("fake");
    expect(JSON.stringify(h)).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY);
  });

  it("is red when the key belongs to another project or demo sign-in fails", async () => {
    const { getHealth } = await import("../src/health");
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: "service_role", ref: "z".repeat(20) });
    expect((await getHealth("provider")).ok).toBe(false);
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt({ role: "service_role", ref });
    listUsers.mockResolvedValue({ error: new Error("401") });
    const h = await getHealth("provider");
    expect(h.demoSignIn).toBe("unavailable");
    expect(h.ok).toBe(false);
    listUsers.mockRejectedValue(new Error("network"));
    expect((await getHealth("provider")).demoSignIn).toBe("unavailable");
  });

  it("the website needs no key; database errors and missing config turn it red", async () => {
    const { getHealth } = await import("../src/health");
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const web = await getHealth("web");
    expect(web.serviceKey).toBe("not-used");
    expect(web.demoSignIn).toBeUndefined();
    expect(web.ok).toBe(true);
    expect((await getHealth("admin")).ok).toBe(false);
    probe.mockResolvedValue({ error: new Error("down") });
    expect((await getHealth("web")).database).toBe("error");
    probe.mockRejectedValue(new Error("down"));
    expect((await getHealth("web")).database).toBe("error");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    const off = await getHealth("web");
    expect(off.database).toBe("not-configured");
    expect(off.commit).toBeNull();
  });
});
