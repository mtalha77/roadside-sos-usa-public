import { describe, expect, it } from "vitest";
import { brand } from "../src/brand";

describe("brand config", () => {
  it("derives every URL and email from the single domain value", () => {
    for (const url of Object.values(brand.urls)) {
      expect(new URL(url).hostname.endsWith(brand.domain)).toBe(true);
    }
    for (const email of Object.values(brand.emails)) {
      expect(email.endsWith(`@${brand.domain}`) || email.endsWith(`@mail.${brand.domain}`)).toBe(
        true,
      );
    }
  });

  it("sends from the mail. subdomain verified in Resend (RSOS-118)", () => {
    expect(brand.emails.noReply).toBe(`no-reply@mail.${brand.domain}`);
    expect(brand.emails.support).toBe(`support@${brand.domain}`);
  });

  it("has a non-empty name", () => {
    expect(brand.name.length).toBeGreaterThan(0);
  });
});
