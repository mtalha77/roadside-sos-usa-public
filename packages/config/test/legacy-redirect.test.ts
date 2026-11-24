import { describe, expect, it } from "vitest";
import { brand, LEGACY_BRAND_PATTERN, LEGACY_DOMAINS, LEGACY_NAMES } from "../src/brand";
import { legacyRedirect } from "../src/legacy-redirect";

const old = LEGACY_DOMAINS[0]!;
const to = (u: string) => legacyRedirect(new URL(u), "new.example");

describe("legacy domain redirects (RSOS-118)", () => {
  it("keeps the subdomain, path and query", () => {
    expect(to(`https://${old}/get-help?x=1`)).toBe("https://new.example/get-help?x=1");
    expect(to(`https://pro.${old}/sign-in`)).toBe("https://pro.new.example/sign-in");
    expect(to(`https://admin.${old}/api/health`)).toBe("https://admin.new.example/api/health");
    expect(to(`https://staging-pro.${old}/`)).toBe("https://staging-pro.new.example/");
  });

  it("sends www to the apex", () => {
    expect(to(`https://www.${old}/terms`)).toBe("https://new.example/terms");
  });

  it("leaves the main domain and look-alikes alone", () => {
    expect(legacyRedirect(new URL(`https://${brand.domain}/`))).toBeNull();
    expect(to(`https://not${old}/`)).toBeNull();
    expect(to("http://localhost:3000/")).toBeNull();
  });
});

describe("legacy brand pattern", () => {
  it("matches the old names and domain in any spelling, never the current brand", () => {
    for (const name of LEGACY_NAMES) {
      expect(LEGACY_BRAND_PATTERN.test(`Welcome to ${name}`)).toBe(true);
      expect(LEGACY_BRAND_PATTERN.test(name.toLowerCase().replace(/ /g, "-"))).toBe(true);
    }
    expect(LEGACY_BRAND_PATTERN.test(`https://pro.${old}/x`)).toBe(true);
    expect(LEGACY_BRAND_PATTERN.test(`${brand.name} ${brand.domain} ${brand.emails.noReply}`)).toBe(
      false,
    );
  });
});
