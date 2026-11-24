import "server-only";
import { featureOn } from "@rsos/config/features";
import { averageFee, breakEvenJobs, proSavings } from "@rsos/core/plans";
import { z } from "zod";
import { getMarketPricing, type PortalContext } from "@/lib/portal";
import { getServerSupabase } from "@/lib/supabase/server";

const Bullets = z.object({ en: z.array(z.string()), es: z.array(z.string()) });

/**
 * Portal > Plan & billing (RSOS-114): the company's plan, what it includes, this month's fees and
 * savings, the personal Pro break-even line, the plans to choose from and Featured per market.
 * Every price comes from the admin catalog.
 */
export async function getPlanPage(ctx: PortalContext) {
  const supabase = await getServerSupabase();
  const providerId = ctx.providerId;
  const { data: mine } = await supabase.rpc("my_markets");
  const markets = (mine ?? []).filter((m) => m.provider_id === providerId);
  const marketSlug = markets[0]?.slug ?? ctx.marketSlug;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [catalog, subs, fees, pricing, featuredByMarket] = await Promise.all([
    supabase.rpc("public_plan_catalog", { p_market_slug: marketSlug }),
    providerId
      ? supabase
          .from("provider_subscriptions")
          .select("*")
          .eq("provider_id", providerId)
          .in("status", ["active", "waitlist"])
      : Promise.resolve({ data: [] }),
    providerId
      ? supabase
          .from("provider_billing_events")
          .select("amount_cents")
          .eq("provider_id", providerId)
          .gte("created_at", since)
      : Promise.resolve({ data: [] }),
    getMarketPricing(marketSlug),
    Promise.all(
      markets.map(async (m) => {
        const { data } = await supabase.rpc("public_plan_catalog", { p_market_slug: m.slug });
        const f = (data ?? []).find((c) => c.plan === "featured");
        return {
          marketId: m.market_id,
          name: m.name,
          price: f?.price_cents ?? null,
          slots: f?.featured_slots ?? 0,
          taken: f?.featured_taken ?? 0,
        };
      }),
    ),
  ]);

  const plans = (catalog.data ?? []).map((c) => ({
    ...c,
    bullets: Bullets.safeParse(c.bullets).data ?? { en: [], es: [] },
  }));
  const basic = plans.find((p) => p.plan === "basic");
  const pro = plans.find((p) => p.plan === "pro");
  const rows = subs.data ?? [];
  const base = rows.find((s) => s.plan !== "featured" && s.status === "active") ?? null;
  const featured = rows.filter((s) => s.plan === "featured");
  const discount = pro?.fee_discount_bps ?? 0;

  // Fees charged in the last 30 days; on Pro they are already discounted, so undo that to compare.
  const charged = (fees.data ?? []).map((f) => f.amount_cents);
  const full =
    base?.plan === "pro" && discount
      ? charged.map((c) => Math.round((c * 10_000) / (10_000 - discount)))
      : charged;
  const marketFees = pricing
    .filter((p) => p.enabled && p.platform_fee_cents !== null)
    .map((p) => p.platform_fee_cents!);
  const avg = averageFee(full) ?? averageFee(marketFees);
  const priceGap = pro && basic ? (pro.price_cents ?? 0) - (basic.price_cents ?? 0) : 0;

  return {
    checkout: featureOn("planCheckout"),
    marketSlug,
    marketName: markets[0]?.name ?? null,
    plans,
    base,
    featured,
    featuredByMarket,
    fees: pricing.filter((p) => p.enabled && p.platform_fee_cents !== null),
    discount,
    month: {
      jobs: charged.length,
      feesCents: charged.reduce((a, b) => a + b, 0),
      savedCents: base?.plan === "pro" ? full.reduce((a, b, i) => a + (b - charged[i]!), 0) : 0,
      /** Basic only: what Pro would have saved last month, after the higher plan price. */
      proWouldSave:
        base?.plan !== "pro" && pro && basic
          ? proSavings(full, discount, pro.price_cents ?? 0, basic.price_cents ?? 0)
          : null,
    },
    breakEven:
      avg !== null && pro && basic
        ? breakEvenJobs(pro.price_cents ?? 0, basic.price_cents ?? 0, avg, discount)
        : null,
    priceGap,
  };
}
