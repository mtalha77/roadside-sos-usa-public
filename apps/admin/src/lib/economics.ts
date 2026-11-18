import "server-only";
import {
  computeEconomics,
  EconomicsInputs,
  type EconomicsResult,
  SCENARIOS,
  type Scenario,
  sumEconomics,
} from "@rsos/core/economics";
import type { AdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type MarketModel = {
  id: string;
  slug: string;
  name: string;
  inputs: Partial<Record<Scenario, EconomicsInputs>>;
  updatedAt: Partial<Record<Scenario, string>>;
};

/** The economics model rows for the markets in view (RLS: analytics roles read, owners edit). */
export async function getModels(ctx: AdminContext): Promise<MarketModel[]> {
  const markets = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  if (!markets.length) return [];
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("economics_models")
    .select("market_id, scenario, inputs, updated_at")
    .in(
      "market_id",
      markets.map((m) => m.id),
    );
  return markets.map((m) => {
    const rows = (data ?? []).filter((r) => r.market_id === m.id);
    const inputs: MarketModel["inputs"] = {};
    const updatedAt: MarketModel["updatedAt"] = {};
    for (const r of rows) {
      const scenario = SCENARIOS.find((s) => s === r.scenario);
      const parsed = EconomicsInputs.safeParse(r.inputs);
      if (scenario && parsed.success) {
        inputs[scenario] = parsed.data;
        updatedAt[scenario] = r.updated_at;
      }
    }
    return { id: m.id, slug: m.slug, name: m.name, inputs, updatedAt };
  });
}

export type ModelTable = {
  rows: { market: MarketModel; scenario: Scenario; result: EconomicsResult }[];
  totals: Record<Scenario, EconomicsResult | null>;
};

/**
 * Results per market and scenario, plus the all-markets total. With `sharedFixed`, one fixed-cost
 * amount (the largest market's) is spread across the markets that have a model, instead of being
 * charged to each market.
 */
export function modelTable(models: MarketModel[], sharedFixed: boolean): ModelTable {
  const rows: ModelTable["rows"] = [];
  const totals = { base: null, strong: null } as ModelTable["totals"];
  for (const scenario of SCENARIOS) {
    const withModel = models.filter((m) => m.inputs[scenario]);
    const pool = Math.max(0, ...withModel.map((m) => m.inputs[scenario]!.fixedCosts));
    const each = withModel.length ? pool / withModel.length : 0;
    const results = withModel.map((m) => {
      const result = computeEconomics(m.inputs[scenario]!, sharedFixed ? each : undefined);
      rows.push({ market: m, scenario, result });
      return result;
    });
    totals[scenario] = results.length ? sumEconomics(results) : null;
  }
  return { rows, totals };
}

/** The last saved versions, newest first (owners and operations managers only, by RLS). */
export async function getModelHistory(marketIds: string[]) {
  if (!marketIds.length) return [];
  const supabase = await getServerSupabase();
  const [{ data }, { data: staff }] = await Promise.all([
    supabase
      .from("economics_model_history")
      .select("id, market_id, scenario, changed_by, changed_at")
      .in("market_id", marketIds)
      .order("changed_at", { ascending: false })
      .limit(12),
    supabase.from("staff_members").select("user_id, display_name"),
  ]);
  return (data ?? []).map((h) => ({
    id: h.id,
    marketId: h.market_id,
    scenario: h.scenario,
    at: h.changed_at,
    by: (staff ?? []).find((s) => s.user_id === h.changed_by)?.display_name ?? null,
  }));
}
