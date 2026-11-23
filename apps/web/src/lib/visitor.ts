import "server-only";
import { cookies, headers } from "next/headers";
import { type Detection, detectMarket, MARKET_COOKIE, readGeoHeaders } from "./market";
import { getMarkets, marketSlugForPoint } from "./site-data";

/** The visitor's market for this request (page market first, then cookie, then IP location). */
export async function getVisitorMarket(pageSlug?: string | null): Promise<Detection> {
  const [markets, store, h] = await Promise.all([getMarkets(), cookies(), headers()]);
  return detectMarket(
    { pageSlug, cookieSlug: store.get(MARKET_COOKIE)?.value, geo: readGeoHeaders(h) },
    markets,
    (lat, lng) => marketSlugForPoint(lat, lng).catch(() => null),
  );
}
