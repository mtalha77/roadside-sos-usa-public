import { LEGACY_BRAND_PATTERN } from "@rsos/config/brand";
import { appUrls, expect, test } from "../support/fixtures";

// RSOS-118: no page shows a legacy name or domain anywhere in its HTML (text, metadata, structured
// data, links), and neither do the sitemap, robots and manifest. Pages come from the sitemap.
const PAGES = {
  web: [
    "/",
    "/get-help",
    "/how-it-works",
    "/about",
    "/contact",
    "/for-providers",
    "/for-providers/apply",
    "/legal/driver-terms",
    "/legal/provider-terms",
    "/legal/privacy",
    "/legal/sms-terms",
    "/legal/cookies",
    "/sitemap.xml",
    "/sitemaps/pages.xml",
    "/robots.txt",
  ],
  provider: ["/sign-in", "/manifest.webmanifest"],
  admin: ["/sign-in"],
} as const;

test.describe("brand scan: no legacy name or domain", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "HTML is the same in every browser");

  for (const [app, paths] of Object.entries(PAGES) as [keyof typeof PAGES, readonly string[]][]) {
    test(`${app} pages`, async ({ request }) => {
      const base = appUrls[app];
      test.skip(!base, `No ${app} URL`);
      for (const path of paths) {
        const res = await request.get(new URL(path, base).toString());
        expect(res.status(), path).toBeLessThan(400);
        expect(await res.text(), `${app}${path}`).not.toMatch(LEGACY_BRAND_PATTERN);
      }
    });
  }
});
