import { describe, expect, it, vi } from "vitest";
import {
  detectMarket,
  formatPhone,
  marketPath,
  nearestMarkets,
  readGeoHeaders,
  type SiteMarket,
} from "../src/lib/market";

// Fake markets (555 numbers); the real list comes from `list_site_markets`.
const market = (slug: string, name: string, state: string, phone: string | null): SiteMarket => ({
  id: crypto.randomUUID(),
  slug,
  name,
  state_code: state,
  time_zone: "America/Chicago",
  status: "test",
  phone,
  center_lat: 0,
  center_lng: 0,
});
const houston = market("houston", "Houston", "TX", "+17135550123");
const sanAntonio = market("san-antonio", "San Antonio", "TX", "+12105550123");
const markets = [houston, sanAntonio];

// Vercel's IP headers for a visitor in downtown Houston, and one in Dallas (outside every market).
const geo = (lat: string, lng: string, city: string, region = "TX") =>
  readGeoHeaders(
    new Headers({
      "x-vercel-ip-latitude": lat,
      "x-vercel-ip-longitude": lng,
      "x-vercel-ip-city": encodeURIComponent(city),
      "x-vercel-ip-country-region": region,
      "x-vercel-ip-country": "US",
    }),
  );
// Stand-in for the database's `market_for_point` (real boundaries are tested in pgTAP).
const forPoint = vi.fn(async (lat: number) => (lat > 29.6 && lat < 30 ? "houston" : null));

describe("market detection (RSOS-019)", () => {
  it("AC1: a Houston visitor gets the Houston market and number without choosing", async () => {
    const d = await detectMarket({ geo: geo("29.7604", "-95.3698", "Houston") }, markets, forPoint);
    expect(d).toMatchObject({
      kind: "market",
      source: "ip",
      market: { slug: "houston", phone: "+17135550123" },
    });
  });

  it("AC2: a visitor outside every market gets the waitlist, with their city", async () => {
    const d = await detectMarket({ geo: geo("32.7767", "-96.797", "Dallas") }, markets, forPoint);
    expect(d).toEqual({ kind: "outside", city: "Dallas", region: "TX" });
  });

  it("the city page market wins, then the visitor's choice, then IP", async () => {
    const g = geo("29.7604", "-95.3698", "Houston");
    expect(
      await detectMarket(
        { pageSlug: "san-antonio", cookieSlug: "houston", geo: g },
        markets,
        forPoint,
      ),
    ).toMatchObject({
      source: "page",
      market: { slug: "san-antonio" },
    });
    expect(
      await detectMarket({ cookieSlug: "san-antonio", geo: g }, markets, forPoint),
    ).toMatchObject({
      source: "cookie",
      market: { slug: "san-antonio" },
    });
  });

  it("ignores unknown slugs and unknown locations; non-US visitors are not told 'not in your area'", async () => {
    expect(
      await detectMarket(
        { pageSlug: "nowhere", cookieSlug: "x", geo: readGeoHeaders(new Headers()) },
        markets,
        forPoint,
      ),
    ).toEqual({
      kind: "unknown",
    });
    const abroad = readGeoHeaders(
      new Headers({
        "x-vercel-ip-latitude": "51.5",
        "x-vercel-ip-longitude": "-0.12",
        "x-vercel-ip-country": "GB",
      }),
    );
    expect(await detectMarket({ geo: abroad }, markets, forPoint)).toEqual({ kind: "unknown" });
  });

  it("AC3: menus and paths come from the market rows, so a new market needs no code", async () => {
    const added = market("test-city", "Test City", "NV", null);
    expect(marketPath(added)).toBe("/roadside-assistance/nv/test-city");
    const d = await detectMarket(
      { cookieSlug: "test-city", geo: readGeoHeaders(new Headers()) },
      [...markets, added],
      forPoint,
    );
    expect(d).toMatchObject({ kind: "market", market: { slug: "test-city", phone: null } });
  });

  it("formats numbers for display", () => {
    expect(formatPhone("+17135550123")).toBe("(713) 555-0123");
    expect(formatPhone("911")).toBe("911");
  });
});

describe("nearby cities", () => {
  it("lists other markets nearest first", () => {
    const at = (slug: string, lat: number, lng: number) => ({
      ...market(slug, slug, "TX", null),
      center_lat: lat,
      center_lng: lng,
    });
    const sa = at("san-antonio", 29.42, -98.49);
    const list = [
      sa,
      at("houston", 29.76, -95.37),
      at("las-vegas", 36.17, -115.14),
      at("austin-test", 30.27, -97.74),
    ];
    expect(nearestMarkets(sa, list).map((m) => m.slug)).toEqual([
      "austin-test",
      "houston",
      "las-vegas",
    ]);
  });
});
