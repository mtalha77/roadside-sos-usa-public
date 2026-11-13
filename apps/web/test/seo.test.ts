import { describe, expect, it } from "vitest";
import type { SiteMarket } from "../src/lib/market";
import { legacyHostsFromEnv, resolveRedirect } from "../src/lib/redirects";
import { indexXml, sitemapPaths, urlsetXml } from "../src/lib/sitemap";

const m = (slug: string, state: string): SiteMarket => ({
  id: crypto.randomUUID(),
  slug,
  name: slug,
  state_code: state,
  time_zone: "America/Chicago",
  status: "test",
  phone: null,
  center_lat: 0,
  center_lng: 0,
});

describe("sitemaps (RSOS-032 AC2)", () => {
  const data = {
    markets: [m("houston", "TX"), m("las-vegas", "NV")],
    services: [
      { slug: "tow", market_count: 2 },
      { slug: "winch-out", market_count: 0 },
    ],
    marketServices: {
      houston: [
        { service_slug: "tow", enabled: true },
        { service_slug: "winch-out", enabled: false },
      ],
      "las-vegas": [{ service_slug: "tow", enabled: true }],
    },
  };

  it("lists only published markets and offered services", () => {
    expect(sitemapPaths("cities", data)).toEqual([
      "/roadside-assistance/tx/houston",
      "/roadside-assistance/nv/las-vegas",
    ]);
    expect(sitemapPaths("services", data)).toEqual(["/services/tow"]);
    expect(sitemapPaths("city-services", data)).toEqual([
      "/roadside-assistance/tx/houston/tow",
      "/roadside-assistance/nv/las-vegas/tow",
    ]);
    expect(sitemapPaths("pages", data)).toEqual(
      expect.arrayContaining(["/", "/faq", "/legal/privacy"]),
    );
    expect(sitemapPaths("pages", data)).not.toContain("/get-help");
  });

  it("a newly activated market appears with no code change", () => {
    const more = { ...data, markets: [...data.markets, m("new-city", "AZ")] };
    expect(sitemapPaths("cities", more)).toContain("/roadside-assistance/az/new-city");
  });

  it("renders valid XML with escaped, absolute URLs", () => {
    const xml = urlsetXml("https://site.test", ["/", "/a&b"]);
    expect(xml).toContain("<loc>https://site.test</loc>");
    expect(xml).toContain("<loc>https://site.test/a&amp;b</loc>");
    expect(indexXml("https://site.test")).toContain(
      "<loc>https://site.test/sitemaps/city-services.xml</loc>",
    );
  });
});

describe("redirects (RSOS-032)", () => {
  const rules = [
    {
      source_path: "/old-houston",
      destination: "/roadside-assistance/tx/houston",
      status_code: 301 as const,
    },
  ];
  const opts = {
    canonicalOrigin: "https://new.test",
    legacyHosts: legacyHostsFromEnv(" old.test, www.old.test "),
  };

  it("moves a legacy domain to the canonical one with the same path (301)", () => {
    expect(resolveRedirect(new URL("https://www.old.test/faq?x=1"), rules, opts)).toEqual({
      location: "https://new.test/faq?x=1",
      status: 301,
    });
  });

  it("follows the redirects table and keeps the query", () => {
    expect(resolveRedirect(new URL("https://new.test/old-houston/?utm=a"), rules, opts)).toEqual({
      location: "https://new.test/roadside-assistance/tx/houston?utm=a",
      status: 301,
    });
    expect(resolveRedirect(new URL("https://new.test/faq"), rules, opts)).toBeNull();
  });
});
