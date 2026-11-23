import { describe, expect, it } from "vitest";
import { getSiteUrl, isIndexable, validateAppEnv } from "../src/site";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("validateAppEnv", () => {
  it("accepts a complete production environment", () => {
    const env = {
      ...base,
      NEXT_PUBLIC_SITE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://site.test",
    };
    expect(validateAppEnv(env)?.NEXT_PUBLIC_SITE_ENV).toBe("production");
  });

  it("fails the build on Vercel when a variable is missing, naming it without values", () => {
    const env = { ...base, NEXT_PUBLIC_SITE_ENV: "production", VERCEL: "1" };
    expect(() => validateAppEnv(env)).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("returns null outside Vercel so CI builds need no secrets", () => {
    expect(validateAppEnv({})).toBeNull();
  });

  it("allows previews without a fixed site URL", () => {
    expect(validateAppEnv({ ...base, NEXT_PUBLIC_SITE_ENV: "preview" })).not.toBeNull();
  });
});

describe("indexing", () => {
  it("only indexes the production website", () => {
    expect(isIndexable("web", { NEXT_PUBLIC_SITE_ENV: "production" })).toBe(true);
    expect(isIndexable("web", { NEXT_PUBLIC_SITE_ENV: "staging" })).toBe(false);
    expect(isIndexable("web", { NEXT_PUBLIC_SITE_ENV: "preview" })).toBe(false);
    expect(isIndexable("provider", { NEXT_PUBLIC_SITE_ENV: "production" })).toBe(false);
    expect(isIndexable("admin", { NEXT_PUBLIC_SITE_ENV: "production" })).toBe(false);
  });
});

describe("getSiteUrl", () => {
  it("prefers the configured URL, then the Vercel URL, then localhost", () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://a.test/" })).toBe("https://a.test");
    expect(getSiteUrl({ VERCEL_BRANCH_URL: "branch.vercel.app" })).toBe(
      "https://branch.vercel.app",
    );
    expect(getSiteUrl({}, 3001)).toBe("http://localhost:3001");
  });
});
