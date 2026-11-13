import { describe, expect, it } from "vitest";
import { findBrandViolations } from "../src/brand-guard";
import { brandInitials, wordmarkSvg } from "../src/logo";

describe("brand guard", () => {
  it("catches a hardcoded brand name in app code", () => {
    const violations = findBrandViolations([
      { path: "apps/web/src/app/page.tsx", content: 'const title = "Roadside SOS USA";' },
    ]);
    expect(violations).toEqual([
      { path: "apps/web/src/app/page.tsx", line: 1, text: 'const title = "Roadside SOS USA";' },
    ]);
  });

  it("catches a hardcoded domain in any file type", () => {
    const violations = findBrandViolations([
      { path: "scripts/deploy.sh", content: "curl https://fixallcontractors.com" },
      { path: ".github/workflows/x.yml", content: "url: https://staging.FIXALLCONTRACTORS.com" },
    ]);
    expect(violations.map((v) => v.path)).toEqual(["scripts/deploy.sh", ".github/workflows/x.yml"]);
  });

  it("allows packages/config, env files and docs", () => {
    expect(
      findBrandViolations([
        { path: "packages/config/src/brand.ts", content: "Roadside SOS" },
        { path: "apps/web/.env.example", content: "NEXT_PUBLIC_APP_DOMAIN=fixallcontractors.com" },
        { path: "docs/reports/batch-1.md", content: "fixallcontractors.com" },
      ]),
    ).toEqual([]);
  });
});

describe("generated logo", () => {
  it("builds initials and a wordmark from the brand name", () => {
    expect(brandInitials("Acme Tow Network")).toBe("AT");
    const svg = wordmarkSvg("Acme & Co");
    expect(svg).toContain("Acme &#38; Co");
    expect(svg).toContain('role="img"');
  });
});
