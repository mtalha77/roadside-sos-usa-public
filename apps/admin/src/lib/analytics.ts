import "server-only";
import { CHANNELS, channelOf, SOURCES, sourceOf } from "@rsos/core/analytics-sources";
import {
  computeEconomics,
  type EconomicsInputs,
  type EconomicsResult,
  FUNNEL_STEPS,
  type FunnelStep,
  modelFunnel,
  rngFor,
  type Scenario,
  scaleEconomics,
} from "@rsos/core/economics";
import { brand } from "@rsos/config/brand";
import { createAdminSupabase } from "@rsos/db/admin";
import type { MarketModel } from "@/lib/economics";
import { getServerSupabase } from "@/lib/supabase/server";

const DAY = 86_400_000;

/** One Analytics screen's numbers. Money in US dollars. Every card is derived from these. */
export type AnalyticsView = {
  funnel: Record<FunnelStep, number>;
  requests: number;
  accepted: number;
  adSpend: number;
  feeRevenue: number;
  paymentFees: number;
  subscriptions: number;
  contribution: number;
  fixedCosts: number;
  profit: number;
  adCostPerAccepted: number | null;
  sources: Record<string, number>;
  channels: Record<string, number>;
};

const empty = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

/** The models in view for a scenario (markets without a model are left out). */
const withInputs = (models: MarketModel[], scenario: Scenario) =>
  models.flatMap((m) => (m.inputs[scenario] ? [{ m, i: m.inputs[scenario]! }] : []));

function fromResults(
  parts: { i: EconomicsInputs; r: EconomicsResult }[],
  sources: Record<string, number>,
  channels: Record<string, number>,
): AnalyticsView {
  const sum = (f: (x: { i: EconomicsInputs; r: EconomicsResult }) => number) =>
    parts.reduce((n, x) => n + f(x), 0);
  const funnel = empty(FUNNEL_STEPS);
  for (const x of parts) {
    const f = modelFunnel(x.i, x.r);
    for (const s of FUNNEL_STEPS) funnel[s] += f[s];
  }
  const accepted = sum((x) => x.r.accepted);
  const adSpend = sum((x) => x.r.adSpend);
  return {
    funnel,
    requests: sum((x) => x.r.requests),
    accepted,
    adSpend,
    feeRevenue: sum((x) => x.r.feeRevenue),
    paymentFees: sum((x) => x.r.paymentFees),
    subscriptions: sum((x) => x.r.subscriptions),
    contribution: sum((x) => x.r.contribution),
    fixedCosts: sum((x) => x.r.fixedCosts),
    profit: sum((x) => x.r.profit),
    adCostPerAccepted: accepted > 0 ? adSpend / accepted : null,
    sources,
    channels,
  };
}

/** Model view: the Economics model's expectation for the range ("Model estimate"). */
export function modelView(models: MarketModel[], days: number, scenario: Scenario): AnalyticsView {
  const parts = withInputs(models, scenario).map(({ i }) => ({
    i,
    r: scaleEconomics(computeEconomics(i), days),
  }));
  const requests = parts.reduce((n, x) => n + x.r.requests, 0);
  // The model's budget is paid search; every modelled request arrives through the website.
  return fromResults(
    parts,
    { ...empty(SOURCES), google_ads: requests },
    { ...empty(CHANNELS), website: requests },
  );
}

/**
 * Demo view (staging and previews only): numbers generated from the model, never from
 * placeholders. Each market's daily volume varies a little (seeded by market and day), so the
 * 30-day totals land within a few percent of the model and shorter ranges stay proportional.
 */
export function demoView(
  models: MarketModel[],
  days: number,
  scenario: Scenario,
  now: number,
): AnalyticsView {
  const today = Math.floor(now / DAY);
  const parts = withInputs(models, scenario).map(({ m, i }) => {
    let factor = 0;
    for (let d = 0; d < days; d++) factor += 0.96 + rngFor(`${m.slug}:${today - d}`) * 0.08;
    // `factor` is about `days`: the range's days, each a little above or below an average day.
    return { i, r: scaleEconomics(computeEconomics(i), factor) };
  });
  const requests = parts.reduce((n, x) => n + x.r.requests, 0);
  return fromResults(
    parts,
    { ...empty(SOURCES), google_ads: requests },
    { ...empty(CHANNELS), website: requests },
  );
}

/**
 * Real view: only real rows, never demo. Requests are a cohort by request date: quoted, picked
 * and completed count only requests made in the range. Money: ad spend entered in Marketing, fees
 * of picked requests, payment fees at the model's rate; subscriptions and fixed costs come from
 * the model for the range (they are not tracked per request yet).
 */
export async function realView(
  marketIds: string[],
  marketSlugs: string[],
  models: MarketModel[],
  days: number,
  now: number,
): Promise<AnalyticsView> {
  const supabase = await getServerSupabase();
  const since = new Date(now - days * DAY);
  const sinceDay = since.toISOString().slice(0, 10);
  const none = { data: [] as never[] };
  const [visits, reqs, spend, drafts] = await Promise.all([
    supabase
      .from("site_visits")
      .select("visits, market_key")
      .gte("day", sinceDay)
      .in("market_key", marketSlugs),
    marketIds.length
      ? supabase
          .from("requests")
          .select(
            "id, channel, source, created_at, quoted_at, accepted_at, completed_at, platform_fee_cents, attributions(gclid, gbraid, wbraid, fbclid, msclkid, utm_source, referrer)",
          )
          .in("market_id", marketIds)
          .neq("status", "draft")
          .gte("created_at", since.toISOString())
          .limit(10_000)
      : Promise.resolve(none),
    marketIds.length
      ? supabase
          .from("ad_spend")
          .select("amount_cents")
          .in("market_id", marketIds)
          .gte("day", sinceDay)
      : Promise.resolve(none),
    // Drafts are private to their visitor; only a count is read here (trusted server code).
    createAdminSupabase()
      .from("request_drafts")
      .select("token", { count: "exact", head: true })
      .gte("created_at", since.toISOString()),
  ]);
  const rows = reqs.data ?? [];
  const web = rows.filter((r) => channelOf(r.channel) === "website");
  const sources = empty(SOURCES);
  const channels = empty(CHANNELS);
  for (const r of rows) {
    const a = (Array.isArray(r.attributions) ? r.attributions[0] : r.attributions) as {
      gclid?: string | null;
      gbraid?: string | null;
      wbraid?: string | null;
      fbclid?: string | null;
      msclkid?: string | null;
      utm_source?: string | null;
      referrer?: string | null;
    } | null;
    sources[
      sourceOf({
        gclid: a?.gclid,
        gbraid: a?.gbraid,
        wbraid: a?.wbraid,
        fbclid: a?.fbclid,
        msclkid: a?.msclkid,
        utmSource: a?.utm_source,
        referrer: a?.referrer,
        phonePurpose: r.source,
        ownHost: brand.domain,
      })
    ] += 1;
    channels[channelOf(r.channel)] += 1;
  }
  const picked = rows.filter((r) => r.accepted_at);
  const accepted = picked.length;
  const feeRevenue = picked.reduce((n, r) => n + r.platform_fee_cents, 0) / 100;
  const adSpend = (spend.data ?? []).reduce((n, s) => n + s.amount_cents, 0) / 100;
  const base = withInputs(models, "base").map(({ i }) => scaleEconomics(computeEconomics(i), days));
  const paymentShare = withInputs(models, "base")[0]?.i.paymentFeeShare ?? 0;
  const subscriptions = base.reduce((n, r) => n + r.subscriptions, 0);
  const fixedCosts = base.reduce((n, r) => n + r.fixedCosts, 0);
  const paymentFees = feeRevenue * paymentShare;
  const contribution = feeRevenue + subscriptions - adSpend - paymentFees;
  return {
    // The funnel follows website requests (phone requests have no visit or started step).
    funnel: {
      visits: (visits.data ?? []).reduce((n, v) => n + v.visits, 0),
      started: (drafts.count ?? 0) + web.length,
      submitted: web.length,
      quoted: web.filter((r) => r.quoted_at || r.accepted_at).length,
      picked: web.filter((r) => r.accepted_at).length,
      completed: web.filter((r) => r.completed_at).length,
    },
    requests: rows.length,
    accepted,
    adSpend,
    feeRevenue,
    paymentFees,
    subscriptions,
    contribution,
    fixedCosts,
    profit: contribution - fixedCosts,
    adCostPerAccepted: accepted > 0 ? adSpend / accepted : null,
    sources,
    channels,
  };
}
