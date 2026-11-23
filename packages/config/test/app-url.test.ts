import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { brand } from "../src/brand";
import { appUrl, productionHosts } from "../src/site";

describe("appUrl", () => {
  it("links to production hosts only from production", () => {
    const env = { NEXT_PUBLIC_SITE_ENV: "production" };
    expect(appUrl("web", env)).toBe(`https://${brand.domain}`);
    expect(appUrl("provider", env)).toBe(`https://pro.${brand.domain}`);
    expect(appUrl("admin", env)).toBe(`https://admin.${brand.domain}`);
  });

  it("links to the staging hosts from staging and previews", () => {
    for (const siteEnv of ["staging", "preview"]) {
      const env = { NEXT_PUBLIC_SITE_ENV: siteEnv };
      expect(appUrl("web", env)).toBe(`https://staging.${brand.domain}`);
      expect(appUrl("provider", env)).toBe(`https://staging-pro.${brand.domain}`);
      expect(appUrl("admin", env)).toBe(`https://staging-admin.${brand.domain}`);
    }
  });

  it("links to localhost in development", () => {
    expect(appUrl("web", {})).toBe("http://localhost:3000");
    expect(appUrl("provider", { NEXT_PUBLIC_SITE_ENV: "development" })).toBe(
      "http://localhost:3001",
    );
  });

  it("an explicit app URL wins (no trailing slash)", () => {
    const env = { NEXT_PUBLIC_SITE_ENV: "staging", NEXT_PUBLIC_ADMIN_URL: "https://a.test/" };
    expect(appUrl("admin", env)).toBe("https://a.test");
  });

  it("never returns a production host outside production", () => {
    const prod = productionHosts();
    for (const siteEnv of ["staging", "preview", "development"])
      for (const app of ["web", "provider", "admin"] as const)
        expect(prod).not.toContain(new URL(appUrl(app, { NEXT_PUBLIC_SITE_ENV: siteEnv })).host);
  });
});

describe("links between apps follow the environment", () => {
  const ROOT = join(__dirname, "../../..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      if (["node_modules", ".next", ".turbo", "dist", "coverage", "test"].includes(name)) return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it("no app or package builds links from brand.urls (use appUrl)", () => {
    const offenders = [...files(join(ROOT, "apps")), ...files(join(ROOT, "packages"))]
      .filter((p) => !p.endsWith(join("config", "src", "brand.ts")))
      .filter((p) => readFileSync(p, "utf8").includes("brand.urls"))
      .map((p) => relative(ROOT, p));
    expect(offenders).toEqual([]);
  });
});
