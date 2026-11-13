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

describe("provider security headers", () => {
  it("applies the baseline headers to every route", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/:path*");
    expect(all?.headers.map((h) => h.key)).toEqual(expect.arrayContaining(REQUIRED));
  });

  it.each(["/", "/api/health", "/some/deep/page", "/robots.txt"])(
    "sends a nonce CSP on %s",
    (path) => {
      const matcher = new RegExp("^" + proxyConfig.matcher[0] + "$");
      expect(matcher.test(path)).toBe(true);
      const res = proxy(new NextRequest("https://app.test" + path));
      const csp = res.headers.get("Content-Security-Policy") ?? "";
      expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      expect(csp).toContain("frame-ancestors 'none'");
    },
  );

  it("uses a new nonce for every request", () => {
    const a = proxy(new NextRequest("https://app.test/")).headers.get("Content-Security-Policy");
    const b = proxy(new NextRequest("https://app.test/")).headers.get("Content-Security-Policy");
    expect(a).not.toBe(b);
  });
});
