import { z } from "zod";

/** A published market as the website sees it (from `list_site_markets`). */
export const SiteMarketSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  state_code: z.string().length(2),
  time_zone: z.string(),
  status: z.enum(["test", "active"]),
  phone: z.string().nullable(),
  center_lat: z.number(),
  center_lng: z.number(),
});
export type SiteMarket = z.infer<typeof SiteMarketSchema>;

export const MARKET_COOKIE = "rsos_market";
/** Remembered for 90 days; the visitor can change it any time. */
export const MARKET_COOKIE_MAX_AGE = 90 * 24 * 3600;

/** URL pieces for a market: /roadside-assistance/{state}/{city}. */
export const marketPath = (m: Pick<SiteMarket, "state_code" | "slug">) =>
  `/roadside-assistance/${m.state_code.toLowerCase()}/${m.slug}`;

export type Detection =
  | { kind: "market"; market: SiteMarket; source: "page" | "cookie" | "ip" }
  | { kind: "outside"; city: string | null; region: string | null }
  | { kind: "unknown" };

/** Vercel's IP location headers (absent locally; tests mock them). */
export function readGeoHeaders(h: Headers) {
  const num = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
  const city = h.get("x-vercel-ip-city");
  return {
    lat: num(h.get("x-vercel-ip-latitude")),
    lng: num(h.get("x-vercel-ip-longitude")),
    city: city ? decodeURIComponent(city) : null,
    region: h.get("x-vercel-ip-country-region"),
    country: h.get("x-vercel-ip-country"),
  };
}

/**
 * Which market a visitor is in: the city page they are on first, then the market they chose
 * (cookie), then their IP location (inside a market's boundary, resolved by the database).
 */
export async function detectMarket(
  input: {
    pageSlug?: string | null;
    cookieSlug?: string | null;
    geo: ReturnType<typeof readGeoHeaders>;
  },
  markets: SiteMarket[],
  marketForPoint: (lat: number, lng: number) => Promise<string | null>,
): Promise<Detection> {
  const bySlug = (s?: string | null) => (s ? markets.find((m) => m.slug === s) : undefined);
  const page = bySlug(input.pageSlug);
  if (page) return { kind: "market", market: page, source: "page" };
  const chosen = bySlug(input.cookieSlug);
  if (chosen) return { kind: "market", market: chosen, source: "cookie" };
  const { lat, lng, city, region, country } = input.geo;
  if (lat === null || lng === null) return { kind: "unknown" };
  const hit = bySlug(await marketForPoint(lat, lng));
  if (hit) return { kind: "market", market: hit, source: "ip" };
  return country && country !== "US" ? { kind: "unknown" } : { kind: "outside", city, region };
}

/** "+17135550123" → "(713) 555-0123" for display; links always use the E.164 form. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** "Houston, TX". */
export const cityLabel = (m: Pick<SiteMarket, "name" | "state_code">) =>
  `${m.name}, ${m.state_code}`;
