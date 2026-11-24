/**
 * Provider plans and Featured placement (RSOS-114): the rules shared by the website, the provider
 * portal and the admin. Prices and settings always come from the admin catalog (database); these
 * functions only apply them.
 */

export type PlanKey = "basic" | "pro";

/** Fee after the plan's discount (basis points, 1500 = 15%), rounded to the cent. */
export function discountedFee(feeCents: number, discountBps: number): number {
  return Math.round((feeCents * (10_000 - discountBps)) / 10_000);
}

/**
 * Jobs a month at which Pro pays for itself: (Pro price - Basic price) / (average fee x discount).
 * Null when it never does (no discount or no fees).
 */
export function breakEvenJobs(
  proCents: number,
  basicCents: number,
  averageFeeCents: number,
  discountBps: number,
): number | null {
  const savedPerJob = (averageFeeCents * discountBps) / 10_000;
  if (savedPerJob <= 0) return null;
  return Math.ceil(Math.max(0, proCents - basicCents) / savedPerJob);
}

/** Average fee over the provider's own jobs (their service mix); null without jobs. */
export function averageFee(feesCents: readonly number[]): number | null {
  if (feesCents.length === 0) return null;
  return feesCents.reduce((a, b) => a + b, 0) / feesCents.length;
}

/**
 * What Pro would have saved on these fees after paying the higher plan price (negative when Pro
 * would have cost more).
 */
export function proSavings(
  feesCents: readonly number[],
  discountBps: number,
  proCents: number,
  basicCents: number,
): number {
  const saved = feesCents.reduce((a, f) => a + (f - discountedFee(f, discountBps)), 0);
  return saved - Math.max(0, proCents - basicCents);
}

/**
 * Seconds before a provider may see a new request. Pro providers see it at once; others wait the
 * first-look window, except when no Pro provider is in range or the offer is an Instant book above
 * the customer's price limit.
 */
export function offerDelaySeconds(opts: {
  plan: PlanKey | null;
  anyProInRange: boolean;
  firstLookSeconds: number;
  instantAboveLimit?: boolean;
}): number | null {
  if (opts.plan === null) return null; // no plan: no offers at all
  if (opts.plan === "pro" || !opts.anyProInRange || opts.instantAboveLimit) return 0;
  return Math.max(0, Math.min(30, opts.firstLookSeconds));
}

/** Technicians allowed on a plan (null: unlimited). */
export function canAddTechnician(limit: number | null, current: number): boolean {
  return limit === null || current < limit;
}

export type FeaturedRules = { priceRulePct: number; etaRuleMinutes: number };
export type RankedQuote = {
  id: string;
  priceCents: number;
  etaMinutes: number;
  featured?: boolean;
};

/**
 * A Featured quote qualifies for the top spot only when its price is within `priceRulePct` of the
 * cheapest quote and its arrival within `etaRuleMinutes` of the fastest, so customers always get a
 * fair deal.
 */
export function featuredQualifies(
  q: RankedQuote,
  quotes: readonly RankedQuote[],
  rules: FeaturedRules,
): boolean {
  if (!q.featured || quotes.length === 0) return false;
  const cheapest = Math.min(...quotes.map((x) => x.priceCents));
  const fastest = Math.min(...quotes.map((x) => x.etaMinutes));
  return (
    q.priceCents <= cheapest * (1 + rules.priceRulePct / 100) &&
    q.etaMinutes <= fastest + rules.etaRuleMinutes
  );
}

/**
 * The quote list in the customer's chosen order, with at most one qualifying Featured quote moved
 * to the top (lowest price first, then fastest). Featured quotes that do not qualify keep their
 * normal position; every Featured quote keeps its label.
 */
export function withFeaturedOnTop<T extends RankedQuote>(
  ordered: readonly T[],
  rules: FeaturedRules,
): { quotes: T[]; topId: string | null } {
  const top = ordered
    .filter((q) => featuredQualifies(q, ordered, rules))
    .sort((a, b) => a.priceCents - b.priceCents || a.etaMinutes - b.etaMinutes)[0];
  if (!top) return { quotes: [...ordered], topId: null };
  return { quotes: [top, ...ordered.filter((q) => q.id !== top.id)], topId: top.id };
}

/**
 * When an existing subscriber starts paying a new price: never when grandfathered, otherwise the
 * first billing date on or after both the effective date and the notice period.
 */
export function priceChangeDate(opts: {
  periodEnd: Date;
  effectiveFrom: Date;
  now: Date;
  noticeDays: number;
  grandfather: boolean;
}): Date | null {
  if (opts.grandfather) return null;
  const earliest = Math.max(
    opts.effectiveFrom.getTime(),
    opts.now.getTime() + opts.noticeDays * 86_400_000,
  );
  for (let i = 0; i <= 24; i++) {
    const d = addMonths(opts.periodEnd, i);
    if (d.getTime() >= earliest) return d;
  }
  return addMonths(opts.periodEnd, 24);
}

/** Adds calendar months like Postgres `+ interval '1 month'` (Jan 30 + 1 month = Feb 28). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** Monthly recurring revenue from active subscriptions. */
export function monthlyRecurringRevenue(
  subs: readonly { status: string; priceCents: number }[],
): number {
  return subs.filter((s) => s.status === "active").reduce((a, s) => a + s.priceCents, 0);
}
