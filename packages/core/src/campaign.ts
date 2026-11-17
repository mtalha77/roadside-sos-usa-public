/**
 * Test campaign analytics (RSOS-089-prep): the numbers that decide the launch city. Pure, so the
 * admin view and its CSV export compute exactly the same thing, and it is unit tested.
 */

export type CampaignRequest = {
  marketId: string;
  status: string;
  createdAt: number;
  contactedAt: number | null;
  assignedAt: number | null;
  completedAt: number | null;
  quotedPriceCents: number | null;
  feeCents: number | null;
};
export type CampaignCall = { marketId: string; direction: string; outcome: string };
export type CampaignSpend = { marketId: string; amountCents: number };

export type CampaignMetrics = {
  marketId: string;
  requests: number;
  calls: number;
  /** Answered inbound calls / inbound calls (0 to 1), null without calls. */
  answerRate: number | null;
  /** Median minutes from request to first contact, null without contacted requests. */
  minutesToContact: number | null;
  /** Median minutes from request to provider assigned. */
  minutesToAssigned: number | null;
  /** Assigned / requests. */
  fillRate: number | null;
  /** Completed / requests. */
  completionRate: number | null;
  avgQuotedPriceCents: number | null;
  feesCents: number;
  spendCents: number;
  costPerRequestCents: number | null;
  costPerCompletedCents: number | null;
};

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export function campaignMetrics(
  marketIds: string[],
  requests: CampaignRequest[],
  calls: CampaignCall[],
  spend: CampaignSpend[],
): CampaignMetrics[] {
  return marketIds.map((marketId) => {
    const req = requests.filter((r) => r.marketId === marketId);
    const inbound = calls.filter((c) => c.marketId === marketId && c.direction === "inbound");
    const answered = inbound.filter((c) => c.outcome === "answered" || c.outcome === "completed");
    const assigned = req.filter((r) => r.assignedAt !== null);
    const completed = req.filter((r) => r.status === "completed");
    const quoted = req.map((r) => r.quotedPriceCents).filter((c): c is number => c !== null);
    const spendCents = spend
      .filter((s) => s.marketId === marketId)
      .reduce((n, s) => n + s.amountCents, 0);
    const minutes = (from: number, to: number | null) =>
      to === null ? null : (to - from) / 60_000;
    return {
      marketId,
      requests: req.length,
      calls: inbound.length,
      answerRate: ratio(answered.length, inbound.length),
      minutesToContact: round1(
        median(
          req
            .map((r) => minutes(r.createdAt, r.contactedAt))
            .filter((m): m is number => m !== null && m >= 0),
        ),
      ),
      minutesToAssigned: round1(
        median(
          req
            .map((r) => minutes(r.createdAt, r.assignedAt))
            .filter((m): m is number => m !== null && m >= 0),
        ),
      ),
      fillRate: ratio(assigned.length, req.length),
      completionRate: ratio(completed.length, req.length),
      avgQuotedPriceCents: quoted.length
        ? Math.round(quoted.reduce((a, b) => a + b, 0) / quoted.length)
        : null,
      feesCents: req.reduce((n, r) => n + (r.feeCents ?? 0), 0),
      spendCents,
      costPerRequestCents: spendCents && req.length ? Math.round(spendCents / req.length) : null,
      costPerCompletedCents:
        spendCents && completed.length ? Math.round(spendCents / completed.length) : null,
    };
  });
}

/** The same numbers as CSV (one row per market), for the owner's spreadsheet. */
export function campaignCsv(rows: (CampaignMetrics & { market: string })[]): string {
  const pct = (r: number | null) => (r === null ? "" : (r * 100).toFixed(1));
  const usd = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head =
    "Market,Requests,Calls,Answer rate %,Minutes to first contact,Minutes to provider assigned,Fill rate %,Completion rate %,Average quoted price,Fees that would have been earned,Ad spend,Cost per request,Cost per completed job";
  const lines = rows.map((r) =>
    [
      cell(r.market),
      r.requests,
      r.calls,
      pct(r.answerRate),
      r.minutesToContact ?? "",
      r.minutesToAssigned ?? "",
      pct(r.fillRate),
      pct(r.completionRate),
      usd(r.avgQuotedPriceCents),
      usd(r.feesCents),
      usd(r.spendCents),
      usd(r.costPerRequestCents),
      usd(r.costPerCompletedCents),
    ].join(","),
  );
  return `${[head, ...lines].join("\n")}\n`;
}
