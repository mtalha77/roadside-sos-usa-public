import "server-only";
import { campaignMetrics, type CampaignMetrics } from "@rsos/core";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

/** Test campaign numbers per selected market for the last `days` days (RLS: staff markets). */
export async function loadCampaign(
  days: number,
): Promise<(CampaignMetrics & { market: string })[]> {
  const ctx = await getAdminContext();
  const markets = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const supabase = await getServerSupabase();
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const ids = markets.map((m) => m.id);
  const [{ data: reqs }, { data: calls }, { data: spend }] = await Promise.all([
    supabase.rpc("campaign_requests", { p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase
      .from("calls")
      .select("market_id, direction, outcome")
      .in("market_id", ids)
      .gte("created_at", from.toISOString()),
    // RSOS-107: imported spend per day, the manual form only for days with no import.
    (
      supabase.rpc as unknown as (
        f: string,
        x: object,
      ) => PromiseLike<{ data: { market_id: string; spend_cents: number }[] | null }>
    )("ad_dashboard", {
      p_from: from.toISOString().slice(0, 10),
      p_to: to.toISOString().slice(0, 10),
    }),
  ]);
  const ms = (v: string | null) => (v ? Date.parse(v) : null);
  const rows = campaignMetrics(
    ids,
    (reqs ?? []).map((r) => ({
      marketId: r.market_id,
      status: r.status,
      createdAt: Date.parse(r.created_at),
      contactedAt: ms(r.contacted_at),
      assignedAt: ms(r.assigned_at),
      completedAt: ms(r.completed_at),
      quotedPriceCents: r.quoted_price_cents,
      feeCents: r.fee_cents,
    })),
    (calls ?? []).map((c) => ({
      marketId: c.market_id,
      direction: c.direction,
      outcome: c.outcome,
    })),
    (spend ?? [])
      .filter((s) => ids.includes(s.market_id))
      .map((s) => ({ marketId: s.market_id, amountCents: Number(s.spend_cents) })),
  );
  return rows.map((r) => ({ ...r, market: markets.find((m) => m.id === r.marketId)?.name ?? "" }));
}
