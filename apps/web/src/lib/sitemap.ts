import { LEGAL_DOCUMENTS } from "@rsos/config/legal";
import { marketPath, type SiteMarket } from "./market";

export const SITEMAPS = ["pages", "cities", "services", "city-services"] as const;
export type SitemapName = (typeof SITEMAPS)[number];

type Service = { slug: string; market_count: number };
type MarketService = { service_slug: string; enabled: boolean };

const STATIC_PAGES = [
  "/",
  "/how-it-works",
  "/faq",
  "/about",
  "/contact",
  "/safety",
  "/for-providers",
  "/for-providers/apply",
];

/**
 * Paths for one sitemap, built only from published data: markets the database publishes (test or
 * active), services offered in at least one of them, and city plus service pages where the service
 * is enabled in that market. Activating a market adds its pages on the next refresh.
 */
export function sitemapPaths(
  name: SitemapName,
  data: {
    markets: SiteMarket[];
    services: Service[];
    marketServices: Record<string, MarketService[]>;
  },
): string[] {
  switch (name) {
    case "pages":
      return [...STATIC_PAGES, ...LEGAL_DOCUMENTS.map((d) => `/legal/${d}`)];
    case "cities":
      return data.markets.map(marketPath);
    case "services":
      return data.services.filter((s) => s.market_count > 0).map((s) => `/services/${s.slug}`);
    case "city-services":
      return data.markets.flatMap((m) =>
        (data.marketServices[m.slug] ?? [])
          .filter((s) => s.enabled)
          .map((s) => `${marketPath(m)}/${s.service_slug}`),
      );
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function urlsetXml(base: string, paths: string[]): string {
  const urls = paths
    .map((p) => `<url><loc>${esc(base + (p === "/" ? "" : p))}</loc></url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function indexXml(base: string): string {
  const items = SITEMAPS.map(
    (n) => `<sitemap><loc>${esc(`${base}/sitemaps/${n}.xml`)}</loc></sitemap>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}
