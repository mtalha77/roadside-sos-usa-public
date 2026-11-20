import { z } from "zod";

/**
 * Economics model (RSOS-113): the owner's per-market unit economics, editable in Admin >
 * Business > Economics model and stored in the database. Everything here is pure arithmetic on
 * those inputs: no market, price or rate lives in code.
 */

export const SCENARIOS = ["base", "strong"] as const;
export type Scenario = (typeof SCENARIOS)[number];

const share = z.number().min(0).max(1);
const usd = z.number().min(0).max(10_000_000);

/** One market's inputs for one scenario. Money in US dollars (the owner's brief uses dollars). */
export const EconomicsInputs = z.object({
  monthlyBudget: usd,
  costPerClick: z.number().positive().max(1000),
  clickToRequest: share,
  acceptance: share,
  /** Service slug to its share of requests (sums to 1). */
  serviceMix: z.record(z.string().min(1).max(40), share),
  /** Service slug to our fee per accepted request. */
  feeByService: z.record(z.string().min(1).max(40), usd),
  /** Payment fees and disputed-lead credits, as a share of fee revenue. */
  paymentFeeShare: share,
  subscriptionsNet: usd,
  fixedCosts: usd,
  /**
   * Funnel steps the brief does not cover, used for the Model and Demo funnels only (labelled as
   * assumptions on the Economics model page): started requests that are submitted, submitted
   * requests that get a quote, accepted jobs that are completed.
   */
  startToSubmit: share.optional(),
  quoteRate: share.optional(),
  completionRate: share.optional(),
  /**
   * RSOS-115: the signup bonus per new provider (bonus credit, USD) and how many new providers
   * join per month: the credit used is a promotion cost (fee revenue stays at full value).
   */
  signupBonus: usd.optional(),
  newProvidersPerMonth: z.number().min(0).max(10_000).optional(),
});
export type EconomicsInputs = z.infer<typeof EconomicsInputs>;

export type EconomicsResult = {
  adSpend: number;
  clicks: number;
  requests: number;
  accepted: number;
  weightedFee: number;
  feeRevenue: number;
  /** Bonus credit used to pay fees (signup bonus x new providers): a promotion cost. */
  promotionCredits: number;
  /** Fee revenue minus promotion credits used. */
  netFeeRevenue: number;
  paymentFees: number;
  subscriptions: number;
  contribution: number;
  fixedCosts: number;
  profit: number;
  /** Ad spend per accepted request (null when nothing is accepted). */
  adCostPerAccepted: number | null;
  /** Accepted requests per month at which profit is zero (null when a request loses money). */
  breakEvenAccepted: number | null;
};

/** Average fee per accepted request, weighted by the service mix (32.50 USD in the brief). */
export function weightedFee(i: Pick<EconomicsInputs, "serviceMix" | "feeByService">): number {
  const total = Object.values(i.serviceMix).reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  return (
    Object.entries(i.serviceMix).reduce((n, [s, w]) => n + w * (i.feeByService[s] ?? 0), 0) / total
  );
}

/**
 * The model, step by step: clicks = budget / CPC; requests = clicks x click-to-request; accepted =
 * requests x acceptance; fee revenue = accepted x weighted fee; payment fees = share of fee
 * revenue; contribution = fee revenue + subscriptions - ad spend - payment fees; profit =
 * contribution - fixed costs. Nothing is rounded here: round only when showing a number.
 * `fixedCosts` overrides the market's own (the "shared across markets" toggle).
 */
export function computeEconomics(i: EconomicsInputs, fixedCosts = i.fixedCosts): EconomicsResult {
  const adSpend = i.monthlyBudget;
  const clicks = adSpend / i.costPerClick;
  const requests = clicks * i.clickToRequest;
  const accepted = requests * i.acceptance;
  const fee = weightedFee(i);
  const feeRevenue = accepted * fee;
  const paymentFees = feeRevenue * i.paymentFeeShare;
  const promotionCredits = (i.signupBonus ?? 0) * (i.newProvidersPerMonth ?? 0);
  const contribution = feeRevenue + i.subscriptionsNet - adSpend - paymentFees - promotionCredits;
  const profit = contribution - fixedCosts;
  // Each accepted request nets the fee minus payment fees; the ad cost per accepted request is
  // the same at any volume for a fixed CPC and rates, so break-even is the volume where the net
  // fee covers ad spend at that cost, plus fixed costs, minus subscriptions.
  const adPer = accepted > 0 ? adSpend / accepted : null;
  const netPer = fee * (1 - i.paymentFeeShare) - (adPer ?? 0);
  const breakEvenAccepted =
    netPer > 0 ? Math.max(0, (fixedCosts - i.subscriptionsNet + promotionCredits) / netPer) : null;
  return {
    adSpend,
    clicks,
    requests,
    accepted,
    weightedFee: fee,
    feeRevenue,
    promotionCredits,
    netFeeRevenue: feeRevenue - promotionCredits,
    paymentFees,
    subscriptions: i.subscriptionsNet,
    contribution,
    fixedCosts,
    profit,
    adCostPerAccepted: adPer,
    breakEvenAccepted,
  };
}

/** Sums several markets (for the "all markets" row). Ad cost per accepted is recomputed. */
export function sumEconomics(rows: EconomicsResult[]): EconomicsResult {
  const add = (k: keyof EconomicsResult) => rows.reduce((n, r) => n + ((r[k] as number) ?? 0), 0);
  const adSpend = add("adSpend");
  const accepted = add("accepted");
  return {
    adSpend,
    clicks: add("clicks"),
    requests: add("requests"),
    accepted,
    weightedFee: accepted > 0 ? add("feeRevenue") / accepted : 0,
    feeRevenue: add("feeRevenue"),
    promotionCredits: add("promotionCredits"),
    netFeeRevenue: add("netFeeRevenue"),
    paymentFees: add("paymentFees"),
    subscriptions: add("subscriptions"),
    contribution: add("contribution"),
    fixedCosts: add("fixedCosts"),
    profit: add("profit"),
    adCostPerAccepted: accepted > 0 ? adSpend / accepted : null,
    breakEvenAccepted: null,
  };
}

/** Scales a monthly result to a number of days (Model view for Today, 7 and 30 days). */
export function scaleEconomics(r: EconomicsResult, days: number): EconomicsResult {
  const f = days / 30;
  const scaled = Object.fromEntries(
    Object.entries(r).map(([k, v]) =>
      typeof v === "number" &&
      !["weightedFee", "adCostPerAccepted", "breakEvenAccepted"].includes(k)
        ? [k, v * f]
        : [k, v],
    ),
  ) as EconomicsResult;
  return scaled;
}

/**
 * The funnel the model expects for a result (Model view, and the demo stream's targets). Visits
 * are the paid clicks; each later step follows the model's rates, so it never exceeds the last.
 */
export function modelFunnel(i: EconomicsInputs, r: EconomicsResult): Record<FunnelStep, number> {
  const submitted = r.requests;
  const started = i.startToSubmit ? Math.min(r.clicks, submitted / i.startToSubmit) : submitted;
  const quoted = Math.max(r.accepted, submitted * (i.quoteRate ?? 1));
  return {
    visits: r.clicks,
    started,
    submitted,
    quoted: Math.min(submitted, quoted),
    picked: r.accepted,
    completed: r.accepted * (i.completionRate ?? 1),
  };
}

/** A repeatable number in [0, 1) for a key (demo variation per market and day). */
export function rngFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------
// Funnel (RSOS-113 C): steps in order, each never above the previous one.
// ---------------------------------------------------------------------------------------------

export const FUNNEL_STEPS = [
  "visits",
  "started",
  "submitted",
  "quoted",
  "picked",
  "completed",
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];
export type FunnelRow = {
  step: FunnelStep;
  count: number;
  /** Step-to-step conversion, 0 to 1 (null for the first step or when the previous step is 0). */
  fromPrevious: number | null;
  /** Conversion from the first step, 0 to 1. */
  fromFirst: number | null;
};

/**
 * Builds the funnel from raw counts. Counts are capped at the previous step so a percentage can
 * never pass 100%; `broken` lists the steps that had to be capped (the page shows a data warning).
 */
export function buildFunnel(raw: Record<FunnelStep, number>): {
  rows: FunnelRow[];
  broken: FunnelStep[];
} {
  const broken: FunnelStep[] = [];
  const rows: FunnelRow[] = [];
  let prev: number | null = null;
  let first: number | null = null;
  for (const step of FUNNEL_STEPS) {
    let count = Math.max(0, Math.round(raw[step] ?? 0));
    if (prev !== null && count > prev) {
      broken.push(step);
      count = prev;
    }
    if (first === null) first = count;
    rows.push({
      step,
      count,
      fromPrevious: prev === null || prev === 0 ? null : count / prev,
      fromFirst: first === 0 || rows.length === 0 ? null : count / first,
    });
    prev = count;
  }
  return { rows, broken };
}
