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

/** Real booking speed for the website's promise (RSOS-108): null minutes below 10 bookings. */
export const getBookingSpeed = unstable_cache(
  async (slug: string): Promise<number | null> =>
    (
      await rpc(
        z.object({ bookings: z.number(), median_minutes: z.number().nullable() }),
        "market_booking_speed",
        { p_market_slug: slug },
      )
    )[0]?.median_minutes ?? null,
  ["market_booking_speed"],
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

export const ServicePageSchema = z.object({
  summary: z.string(),
  covers: z.array(z.string()),
  not_covered: z.array(z.string()),
  what_to_expect: z.array(z.string()),
  onsite_minutes_min: z.number().nullable(),
  onsite_minutes_max: z.number().nullable(),
  safety_tips: z.array(z.string()),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
});
export type ServicePage = z.infer<typeof ServicePageSchema>;

export const getServicePage = unstable_cache(
  async (slug: string, locale: string): Promise<ServicePage | null> =>
    (
      await rpc(ServicePageSchema, "get_service_page", { p_service_slug: slug, p_locale: locale })
    )[0] ?? null,
  ["get_service_page"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

export const getMarketServiceNote = unstable_cache(
  async (market: string, service: string, locale: string): Promise<string | null> => {
    const supabase = createPublicSupabase();
    if (!supabase) return null;
    const { data, error } = await (
      supabase.rpc as (f: string, a?: object) => PromiseLike<{ data: unknown; error: unknown }>
    )("get_market_service_note", {
      p_market_slug: market,
      p_service_slug: service,
      p_locale: locale,
    });
    if (error) throw new Error("Supabase get_market_service_note failed");
    return z
      .string()
      .nullable()
      .parse(data ?? null);
  },
  ["get_market_service_note"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

/** RSOS-114: the provider plan catalog for one city (prices from the admin catalog). */
export const PlanSchema = z.object({
  plan: z.enum(["basic", "pro", "featured"]),
  name: z.string(),
  price_cents: z.number().nullable(),
  fee_discount_bps: z.number(),
  first_look_seconds: z.number(),
  technician_limit: z.number().nullable(),
  insights_level: z.enum(["basic", "full"]),
  auto_topup: z.boolean(),
  bullets: z.object({ en: z.array(z.string()), es: z.array(z.string()) }),
  sort_order: z.number(),
  offer_cents: z.number().nullable(),
  offer_ends_at: z.string().nullable(),
  featured_slots: z.number().nullable(),
  featured_taken: z.number().nullable(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const getPlanCatalog = unstable_cache(
  async (marketSlug: string | null): Promise<Plan[]> =>
    rpc(PlanSchema, "public_plan_catalog", { p_market_slug: marketSlug }),
  ["public_plan_catalog"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

const FeaturedRulesSchema = z.object({ price_rule_pct: z.number(), eta_rule_minutes: z.number() });

/** The market's Featured placement rules (RSOS-114); defaults 15% and 10 minutes. */
export const getFeaturedRules = unstable_cache(
  async (marketSlug: string) => {
    const [row] = await rpc(FeaturedRulesSchema, "featured_rules", { p_market_slug: marketSlug });
    return {
      priceRulePct: row?.price_rule_pct ?? 15,
      etaRuleMinutes: row?.eta_rule_minutes ?? 10,
    };
  },
  ["featured_rules"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

const BookingFeeSchema = z.object({
  enabled: z.boolean(),
  amount_cents: z.number().int(),
  free_cancel_seconds: z.number().int(),
});

/** The customer booking fee in a market (RSOS-117): off everywhere unless the Owner turns it on. */
export const getBookingFee = unstable_cache(
  async (marketSlug: string) => {
    const [row] = await rpc(BookingFeeSchema, "public_booking_fee", { p_market_slug: marketSlug });
    return {
      enabled: row?.enabled ?? false,
      amountCents: row?.amount_cents ?? 500,
      freeCancelSeconds: row?.free_cancel_seconds ?? 120,
    };
  },
  ["booking_fee"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);

const FeaturedProviderSchema = z.object({ provider_id: z.string(), name: z.string() });

/** Featured providers in a city (RSOS-114), shown first on the city page with the label. */
export const getFeaturedProviders = unstable_cache(
  async (marketSlug: string) =>
    rpc(FeaturedProviderSchema, "featured_providers", { p_market_slug: marketSlug }),
  ["featured_providers"],
  { revalidate: REVALIDATE, tags: [SITE_TAG] },
);
