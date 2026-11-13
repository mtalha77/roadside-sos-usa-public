import "server-only";
import { createPublicSupabase } from "@rsos/db/public";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { type SiteMarket, SiteMarketSchema } from "./market";

/** Cache tag for everything the website reads from the database (revalidated on market changes). */
export const SITE_TAG = "site-data";
const REVALIDATE = 300;

export const SiteServiceSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  icon_key: z.string(),
  needs_destination: z.boolean(),
  sort_order: z.number(),
  price_min_cents: z.number().nullable(),
  price_max_cents: z.number().nullable(),
  market_count: z.number(),
});
export type SiteService = z.infer<typeof SiteServiceSchema>;

export const MarketServiceSchema = z.object({
  service_slug: z.string(),
  service_name: z.string(),
  icon_key: z.string(),
  needs_destination: z.boolean(),
  sort_order: z.number(),
  enabled: z.boolean(),
  price_min_cents: z.number().nullable(),
  price_max_cents: z.number().nullable(),
  price_note: z.string().nullable(),
  platform_fee_cents: z.number().nullable(),
});
export type MarketService = z.infer<typeof MarketServiceSchema>;

export const MarketStatsSchema = z.object({
  provider_count: z.number(),
  avg_eta_minutes: z.number().nullable(),
  completed_jobs: z.number(),
});
export type MarketStats = z.infer<typeof MarketStatsSchema>;

async function rpc<T>(
  schema: z.ZodType<T>,
  fn: string,
  args?: Record<string, unknown>,
): Promise<T[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];
  // Function names and rows are validated with Zod (rule 3), so the call is untyped on purpose.
  const { data, error } = await (
    supabase.rpc as (f: string, a?: object) => PromiseLike<{ data: unknown; error: unknown }>
  )(fn, args);
  if (error) throw new Error(`Supabase ${fn} failed`);
  return z.array(schema).parse(data ?? []);
}

export const getMarkets = unstable_cache(
  async (): Promise<SiteMarket[]> => rpc(SiteMarketSchema, "list_site_markets"),
  ["list_site_markets"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

export const getServices = unstable_cache(
  async (): Promise<SiteService[]> => rpc(SiteServiceSchema, "list_public_services"),
  ["list_public_services"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

export const getMarketServices = unstable_cache(
  async (slug: string): Promise<MarketService[]> =>
    rpc(MarketServiceSchema, "get_market_services", { p_market_slug: slug }),
  ["get_market_services"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

export const getMarketStats = unstable_cache(
  async (slug: string): Promise<MarketStats | null> =>
    (await rpc(MarketStatsSchema, "market_public_stats", { p_market_slug: slug }))[0] ?? null,
  ["market_public_stats"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

/** Market slug for a point (any published market). Not cached: one call per detection. */
export async function marketSlugForPoint(lat: number, lng: number): Promise<string | null> {
  const rows = await rpc(z.object({ slug: z.string(), status: z.string() }), "market_for_point", {
    p_lat: lat,
    p_lng: lng,
  });
  const row = rows[0];
  return row && (row.status === "test" || row.status === "active") ? row.slug : null;
}

export async function getMarketByPath(state: string, city: string) {
  const m = (await getMarkets()).find((x) => x.slug === city);
  return m && m.state_code.toLowerCase() === state.toLowerCase() ? m : null;
}

export const MarketPageSchema = z.object({
  headline: z.string(),
  intro: z.string(),
  areas: z.array(z.string()),
  highways: z.array(z.string()),
  local_tips: z.array(z.string()),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  updated_at: z.string(),
});
export type MarketPage = z.infer<typeof MarketPageSchema>;

/** City page copy from `market_pages` (falls back to English); null when none is written yet. */
export const getMarketPage = unstable_cache(
  async (slug: string, locale: string): Promise<MarketPage | null> =>
    (
      await rpc(MarketPageSchema, "get_market_page", { p_market_slug: slug, p_locale: locale })
    )[0] ?? null,
  ["get_market_page"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);
