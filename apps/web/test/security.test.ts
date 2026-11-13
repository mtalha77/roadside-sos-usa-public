import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { config as proxyConfig, proxy } from "../src/proxy";

const REQUIRED = [
  "Strict-Transport-Security",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
];

describe("web security headers", () => {
  it("applies the baseline headers to every route", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/:path*");
    expect(all?.headers.map((h) => h.key)).toEqual(expect.arrayContaining(REQUIRED));
  });

  it.each(["/", "/api/health", "/some/deep/page", "/robots.txt"])(
    "sends a nonce CSP on %s",
    async (path) => {
      const matcher = new RegExp("^" + proxyConfig.matcher[0] + "$");
      expect(matcher.test(path)).toBe(true);
      const res = await proxy(new NextRequest("https://app.test" + path));
      const csp = res.headers.get("Content-Security-Policy") ?? "";
      expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      expect(csp).toContain("frame-ancestors 'none'");
    },
  );

  it("uses a new nonce for every request", async () => {
    const a = (await proxy(new NextRequest("https://app.test/"))).headers.get(
      "Content-Security-Policy",
    );
    const b = (await proxy(new NextRequest("https://app.test/"))).headers.get(
      "Content-Security-Policy",
    );
    expect(a).not.toBe(b);
  });

  it("sends a legacy domain to the canonical one with a 301 (domain change ready)", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://new.test";
    process.env.REDIRECT_FROM_HOSTS = "old.test";
    const res = await proxy(new NextRequest("https://old.test/faq?x=1"));
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://new.test/faq?x=1");
    delete process.env.REDIRECT_FROM_HOSTS;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });
});
