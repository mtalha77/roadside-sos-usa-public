import { describe, expect, it } from "vitest";
import { projectRefFromUrl, serviceKeyStatus } from "../src/key-check";

// Fake, unsigned JWT-shaped strings for tests (no real key material).
const jwt = (claims: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const url = "https://abcdefghijklmnopqrst.supabase.co";

describe("service role key project check", () => {
  it("reads the project ref from the Supabase URL", () => {
    expect(projectRefFromUrl(url)).toBe("abcdefghijklmnopqrst");
    expect(projectRefFromUrl("https://example.test")).toBeNull();
    expect(projectRefFromUrl("not a url")).toBeNull();
    expect(projectRefFromUrl(undefined)).toBeNull();
  });

  it("matches a service role key for the same project", () => {
    const key = jwt({ role: "service_role", ref: "abcdefghijklmnopqrst" });
    expect(
      serviceKeyStatus({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key }),
    ).toBe("match");
  });

  it("flags a key from another project, or an anon key", () => {
    const other = jwt({ role: "service_role", ref: "zzzzzzzzzzzzzzzzzzzz" });
    const anon = jwt({ role: "anon", ref: "abcdefghijklmnopqrst" });
    for (const key of [other, anon])
      expect(
        serviceKeyStatus({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key }),
      ).toBe("mismatch");
  });

  it("reports missing and unverifiable keys", () => {
    expect(serviceKeyStatus({ NEXT_PUBLIC_SUPABASE_URL: url })).toBe("missing");
    expect(
      serviceKeyStatus({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x" }),
    ).toBe("unverifiable");
    expect(
      serviceKeyStatus({ NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: "garbage" }),
    ).toBe("unverifiable");
  });

  it("logs a loud message without the key when it does not match", async () => {
    const { assertServiceKeyProject } = await import("../src/key-check");
    const key = jwt({ role: "service_role", ref: "zzzzzzzzzzzzzzzzzzzz" });
    const errors: string[] = [];
    const orig = console.error;
    console.error = (m: string) => void errors.push(m);
    assertServiceKeyProject("admin", {
      NEXT_PUBLIC_SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: key,
    });
    console.error = orig;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/does not belong/);
    expect(errors[0]).not.toContain(key);
  });
});
