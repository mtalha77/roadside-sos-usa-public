import "server-only";
import { monthlyRecurringRevenue } from "@rsos/core/plans";
import { z } from "zod";
import type { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

type Ctx = Awaited<ReturnType<typeof getAdminContext>>;

export const PLAN_KEYS = ["basic", "pro", "featured"] as const;
export type PlanKeyAll = (typeof PLAN_KEYS)[number];

const Bullets = z.object({ en: z.array(z.string()), es: z.array(z.string()) });

/**
 * Admin > Business > Plans & pricing (RSOS-114): the catalog, current prices per market, Featured
 * settings, first-month offers, subscribers and the numbers (plan mix, MRR, churn, Featured fill).
 */
export async function getPlans(ctx: Ctx) {
  const supabase = await getServerSupabase();
  const inView = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const ids = inView.map((m) => m.id);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [catalog, prices, featured, offers, subs, ended, upgrades, providers] = await Promise.all([
    supabase.from("plan_catalog").select("*").order("sort_order"),
    supabase
      .from("plan_prices")
      .select("plan, market_id, price_cents, effective_from, grandfather, notice_days, created_at")
      .order("effective_from", { ascending: false })
      .limit(300),
    supabase.from("featured_settings").select("*").in("market_id", ids),
    supabase.from("plan_offers").select("*").in("market_id", ids),
    supabase.rpc("plan_subscribers"),
    supabase
      .from("provider_subscriptions")
      .select("id", { count: "exact", head: true })
      .in("plan", ["basic", "pro"])
      .eq("status", "ended")
      .gte("ended_at", since),
    supabase
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "plan.start")
      .contains("data", { plan: "pro", from: "basic" })
      .gte("created_at", since),
    supabase
      .from("providers")
      .select("id, name, market_ids")
      .eq("status", "active")
      .eq("is_demo", false)
      .order("name")
      .limit(500),
  ]);

  const now = Date.now();
  /** The price new subscribers pay today: the market's own row, else the default. */
  const current = (plan: string, marketId: string | null) =>
    (prices.data ?? []).find(
      (p) => p.plan === plan && p.market_id === marketId && Date.parse(p.effective_from) <= now,
    );
  const priceNow = (plan: string, marketId: string | null) =>
    ((marketId ? current(plan, marketId) : undefined) ?? current(plan, null))?.price_cents ?? null;
  const scheduled = (prices.data ?? []).filter((p) => Date.parse(p.effective_from) > now);

  const rows = (subs.data ?? []).filter((s) => ids.includes(s.market_id));
  const active = rows.filter((s) => s.status === "active");
  const base = active.filter((s) => s.plan !== "featured");
  const featuredBy = (marketId: string) =>
    active.filter((s) => s.plan === "featured" && s.market_id === marketId).length;
  const waitlistBy = (marketId: string) =>
    rows.filter((s) => s.plan === "featured" && s.status === "waitlist" && s.market_id === marketId)
      .length;

  return {
    markets: inView,
    catalog: (catalog.data ?? []).map((c) => ({
      ...c,
      bullets: Bullets.safeParse(c.bullets).data ?? { en: [], es: [] },
    })),
    priceNow,
    scheduled,
    featured: inView.map((m) => {
      const s = (featured.data ?? []).find((f) => f.market_id === m.id);
      return {
        market: m,
        slots: s?.slots ?? 3,
        priceRulePct: s?.price_rule_pct ?? 15,
        etaRuleMinutes: s?.eta_rule_minutes ?? 10,
        serviceSlots: s?.service_slots ?? false,
        taken: featuredBy(m.id),
        waitlist: waitlistBy(m.id),
      };
    }),
    offers: offers.data ?? [],
    subscribers: rows,
    providersWithoutPlan: (providers.data ?? []).filter(
      (p) =>
        p.market_ids.some((id) => ids.includes(id)) && !base.some((s) => s.provider_id === p.id),
    ),
    totals: {
      mrr: monthlyRecurringRevenue(
        active.map((s) => ({ status: s.status, priceCents: s.price_cents })),
      ),
      basic: base.filter((s) => s.plan === "basic").length,
      pro: base.filter((s) => s.plan === "pro").length,
      featured: active.filter((s) => s.plan === "featured").length,
      churn30: ended.count ?? 0,
      upgrades30: upgrades.count ?? 0,
    },
  };
}

/** Who a price change affects (the database preview; nothing is written). */
export async function previewPriceChange(p: {
  plan: PlanKeyAll;
  market: string | null;
  priceCents: number;
  effectiveFrom: string;
  grandfather: boolean;
  noticeDays: number;
}) {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.rpc("set_plan_price", {
    p_plan: p.plan,
    p_market_id: p.market as string,
    p_price_cents: p.priceCents,
    p_effective_from: p.effectiveFrom,
    p_grandfather: p.grandfather,
    p_notice_days: p.noticeDays,
    p_dry_run: true,
  });
  return { rows: data ?? [], error: error?.message ?? null };
}

const PriceChange = z.object({
  plan: z.enum(["basic", "pro", "featured"]),
  market: z.union([z.literal(""), z.uuid()]),
  price: z.coerce
    .number()
    .min(0)
    .max(1000)
    .transform((d) => Math.round(d * 100)),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  existing: z.enum(["next", "grandfather"]),
  notice: z.coerce.number().int().min(0).max(365),
});

/** Parses the price form (the page uses it for the preview, this action for the change). */
export function parsePriceChange(v: Record<string, unknown>) {
  const p = PriceChange.safeParse(v);
  if (!p.success || p.data.price <= 0) return null;
  const from = new Date(`${p.data.from}T00:00:00Z`);
  const startsNow = from.getTime() <= Date.now();
  return {
    plan: p.data.plan,
    market: p.data.market || null,
    priceCents: p.data.price,
    effectiveFrom: (startsNow ? new Date() : from).toISOString(),
    grandfather: p.data.existing === "grandfather",
    noticeDays: p.data.notice,
  };
}
