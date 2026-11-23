import { describe, expect, it } from "vitest";
import { buildCsp, createNonce, securityHeaders } from "../src/security";

describe("securityHeaders", () => {
  it.each(["web", "provider", "admin"] as const)("sends the baseline headers for %s", (app) => {
    const names = securityHeaders(app).map((h) => h.key);
    expect(names).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "Referrer-Policy",
        "Permissions-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
      ]),
    );
  });

  it("allows geolocation only on the public website", () => {
    const policy = (app: "web" | "provider" | "admin") =>
      securityHeaders(app).find((h) => h.key === "Permissions-Policy")?.value;
    expect(policy("web")).toContain("geolocation=(self)");
    expect(policy("provider")).toContain("geolocation=()");
    expect(policy("admin")).toContain("geolocation=()");
  });
});

describe("buildCsp", () => {
  it("uses the nonce, blocks framing and plugins, and allows only listed services", () => {
    const csp = buildCsp({ nonce: "abc" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    for (const host of [
      "js.stripe.com",
      "challenges.cloudflare.com",
      "maps.googleapis.com",
      "supabase.co",
      "posthog.com",
      "googletagmanager.com",
      "sentry.io",
      "twilio.com",
      "vercel",
    ]) {
      expect(csp).toContain(host);
    }
  });

  it("only allows eval in development", () => {
    expect(buildCsp({ nonce: "n", dev: true })).toContain("'unsafe-eval'");
  });

  it("creates a fresh nonce each time", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});
