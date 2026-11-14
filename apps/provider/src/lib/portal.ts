import "server-only";
import { isDemoMode } from "@rsos/config/demo";
import { demoMarkets } from "@rsos/config/demo-fixtures";
import { demoPortal } from "@rsos/core/demo";
import { createPublicSupabase } from "@rsos/db/public";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

const StatusRow = z.object({
  provider_id: z.string(),
  name: z.string(),
  status: z.string(),
  status_reason: z.string().nullable(),
  role: z.enum(["owner", "manager", "operator"]),
});

/** The signed-in member's company and role (real, from the database). */
export async function getPortalContext() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc("my_provider_status");
  const row = StatusRow.safeParse(Array.isArray(data) ? data[0] : null).data ?? null;
  const company = row?.name ?? "";
  // The demo company's market comes from the fixtures; real companies use their first market.
  const marketSlug =
    Object.entries(demoMarkets).find(([, m]) => m.providers.some((p) => p.name === company))?.[0] ??
    "san-antonio";
  const providerSlug = demoMarkets[marketSlug]?.providers.find((p) => p.name === company)?.slug;
  return {
    company,
    role: row?.role ?? "operator",
    status: row?.status ?? "active",
    providerId: row?.provider_id ?? null,
    marketSlug,
    providerSlug,
    demo: isDemoMode(),
    canSeeMoney: row?.role !== "operator",
  };
}
export type PortalContext = Awaited<ReturnType<typeof getPortalContext>>;

type Svc = {
  service_slug: string;
  service_name: string;
  enabled: boolean;
  price_min_cents: number | null;
  price_max_cents: number | null;
  platform_fee_cents: number | null;
};

/** Real prices and fees for the market (public function), used for quotes and fees everywhere. */
export async function getMarketPricing(marketSlug: string): Promise<Svc[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];
  const { data } = await (
    supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>
  )("get_market_services", { p_market_slug: marketSlug });
  return (Array.isArray(data) ? data : []) as Svc[];
}

/** Demo portal data for this company, priced with the market's real ranges and fees. */
export async function getPortalData(ctx: PortalContext, now: number) {
  const pricing = await getMarketPricing(ctx.marketSlug);
  const ranges = Object.fromEntries(
    pricing
      .filter((p) => p.price_min_cents !== null)
      .map((p) => [p.service_slug, { min: p.price_min_cents!, max: p.price_max_cents! }]),
  );
  const fees = Object.fromEntries(
    pricing
      .filter((p) => p.platform_fee_cents !== null)
      .map((p) => [p.service_slug, p.platform_fee_cents!]),
  );
  return {
    pricing,
    data: demoPortal(now, {
      marketSlug: ctx.marketSlug,
      providerSlug: ctx.providerSlug,
      ranges,
      fees,
    }),
  };
}

/** Real wallet balance (provider_wallets, owner and manager only by RLS). */
export async function getWalletBalance(providerId: string | null): Promise<number | null> {
  if (!providerId) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("provider_wallets")
    .select("balance_cents")
    .eq("provider_id", providerId)
    .maybeSingle();
  return data?.balance_cents ?? null;
}
