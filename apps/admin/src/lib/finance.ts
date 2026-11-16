import "server-only";
import { demoMarkets } from "@rsos/config/demo-fixtures";
import { demoPortal, demoStream } from "@rsos/core/demo";

export type LedgerRow = {
  id: string;
  at: number;
  market: string;
  provider: string;
  kind: "fee" | "top_up" | "credit" | "plan";
  amountCents: number;
  job: string | null;
  service: string | null;
};

/** Demo ledger across every demo company in the chosen markets (finance has no real data yet). */
export function demoLedger(now: number, markets: string[]): LedgerRow[] {
  return markets
    .filter((m) => demoMarkets[m])
    .flatMap((m) =>
      demoMarkets[m]!.providers.flatMap((p) => {
        const portal = demoPortal(now, { marketSlug: m, providerSlug: p.slug });
        const jobs = new Map(portal.history.map((j) => [j.code, j]));
        return portal.txns.map((x) => ({
          id: `${p.slug}-${x.id}`,
          at: x.at,
          market: m,
          provider: p.name,
          kind: x.kind,
          amountCents: x.amountCents,
          job: x.jobCode,
          service: x.jobCode ? (jobs.get(x.jobCode)?.serviceSlug ?? null) : null,
        }));
      }),
    )
    .sort((a, b) => b.at - a.at);
}

/** Revenue (fees) by market, service and source over the last 30 days of the demo stream. */
export function demoRevenue(now: number, markets: string[], ledger: LedgerRow[]) {
  const since = now - 30 * 86_400_000;
  const fees = ledger.filter((x) => x.kind === "fee" && x.at > since);
  const sum = (key: (x: LedgerRow) => string | null) => {
    const m = new Map<string, number>();
    for (const x of fees) {
      const k = key(x) ?? "other";
      m.set(k, (m.get(k) ?? 0) + Math.abs(x.amountCents));
    }
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const sources = new Map<string, number>();
  for (const r of demoStream(now, { markets: markets.filter((m) => demoMarkets[m]) }))
    sources.set(r.source, (sources.get(r.source) ?? 0) + 1);
  const totalReq = [...sources.values()].reduce((a, b) => a + b, 0) || 1;
  const totalFees = fees.reduce((a, x) => a + Math.abs(x.amountCents), 0);
  return {
    byMarket: sum((x) => x.market),
    byService: sum((x) => x.service),
    bySource: [...sources].map(
      ([k, n]) => [k, Math.round((n / totalReq) * totalFees)] as [string, number],
    ),
    total: totalFees,
  };
}
