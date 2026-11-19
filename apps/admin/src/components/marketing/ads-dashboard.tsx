import { dashboardRow } from "@rsos/core/ads";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

export const AdRow = z.object({
  day: z.string(),
  market_id: z.string(),
  channel: z.string(),
  spend_cents: z.coerce.number(),
  clicks: z.coerce.number(),
  calls: z.coerce.number(),
  qualified_calls: z.coerce.number(),
  requests: z.coerce.number(),
  assigned: z.coerce.number(),
  completed: z.coerce.number(),
  fees_cents: z.coerce.number(),
});
export type AdRow = z.infer<typeof AdRow>;

export async function loadAdRows(from: string, to: string): Promise<AdRow[]> {
  const supabase = await getServerSupabase();
  const { data } = await (
    supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>
  )("ad_dashboard", { p_from: from, p_to: to });
  return z
    .array(AdRow)
    .catch([])
    .parse(data ?? []);
}

/** Groups day rows by market and channel, with the spend per day for the trend line. */
export function groupAdRows(rows: AdRow[]) {
  const groups = new Map<
    string,
    { market: string; channel: string; days: Map<string, number>; sum: AdRow }
  >();
  for (const r of rows) {
    const k = `${r.market_id}|${r.channel}`;
    const g = groups.get(k) ?? {
      market: r.market_id,
      channel: r.channel,
      days: new Map<string, number>(),
      sum: {
        ...r,
        spend_cents: 0,
        clicks: 0,
        calls: 0,
        qualified_calls: 0,
        requests: 0,
        assigned: 0,
        completed: 0,
        fees_cents: 0,
      },
    };
    g.days.set(r.day, (g.days.get(r.day) ?? 0) + r.spend_cents);
    for (const f of [
      "spend_cents",
      "clicks",
      "calls",
      "qualified_calls",
      "requests",
      "assigned",
      "completed",
      "fees_cents",
    ] as const)
      g.sum[f] += r[f];
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    row: dashboardRow({
      spendCents: g.sum.spend_cents,
      clicks: g.sum.clicks,
      calls: g.sum.calls,
      qualifiedCalls: g.sum.qualified_calls,
      requests: g.sum.requests,
      assigned: g.sum.assigned,
      completed: g.sum.completed,
      feesCents: g.sum.fees_cents,
    }),
  }));
}

function Trend({ points, label }: { points: number[]; label: string }) {
  const max = Math.max(1, ...points);
  const w = 80;
  const h = 24;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const d = points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${(i * step).toFixed(1)},${(h - (p / max) * (h - 2) - 1).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg width={w} height={h} role="img" aria-label={label} className="text-primary">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The ads dashboard (RSOS-107) on Marketing: per market and channel for the date range, spend,
 * clicks, calls, qualified calls, requests, assigned and completed jobs, cost per request and per
 * completed job, fees earned and return on ad spend, with a small spend trend and a CSV export.
 */
export async function AdsDashboard({
  from,
  to,
  marketIds,
  marketName,
}: {
  from: string;
  to: string;
  marketIds: string[];
  marketName: (id: string) => string;
}) {
  const t = await getTranslations("admin.ads");
  const rows = (await loadAdRows(from, to)).filter((r) => marketIds.includes(r.market_id));
  const groups = groupAdRows(rows);
  const days: string[] = [];
  for (let d = Date.parse(`${from}T00:00:00Z`); d <= Date.parse(`${to}T00:00:00Z`); d += 86_400_000)
    days.push(new Date(d).toISOString().slice(0, 10));
  const money = (c: number | null) =>
    c === null
      ? "–"
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
  const channel = (c: string) =>
    t.has(`channels.${c}` as never) ? t(`channels.${c}` as never) : c;
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="ads-h">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 id="ads-h" className="font-semibold">
          {t("dashTitle")}
        </h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/marketing/connections"
            className="inline-flex min-h-12 items-center underline underline-offset-4"
          >
            {t("connections")}
          </Link>
          <a
            href={`/api/marketing/ads-csv?from=${from}&to=${to}`}
            download
            className="inline-flex min-h-12 items-center underline underline-offset-4"
          >
            {t("csv")}
          </a>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{t("dashNote")}</p>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noData")}</p>
      ) : (
        <div tabIndex={0} role="group" aria-label={t("dashTitle")} className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm">
            <caption className="sr-only">{t("dashTitle")}</caption>
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                {(
                  [
                    "market",
                    "channel",
                    "trend",
                    "spend",
                    "clicks",
                    "calls",
                    "qualified",
                    "requests",
                    "assigned",
                    "completed",
                    "perRequest",
                    "perCompleted",
                    "fees",
                    "roas",
                  ] as const
                ).map((k) => (
                  <th key={k} scope="col" className="py-2 pr-3 font-medium">
                    {t(`cols.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map((g) => (
                <tr key={`${g.market}|${g.channel}`}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {marketName(g.market)}
                  </th>
                  <td className="py-2 pr-3">{channel(g.channel)}</td>
                  <td className="py-2 pr-3">
                    <Trend
                      points={days.map((d) => g.days.get(d) ?? 0)}
                      label={`${t("cols.trend")}: ${marketName(g.market)}, ${channel(g.channel)}`}
                    />
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{money(g.row.spendCents)}</td>
                  <td className="py-2 pr-3 tabular-nums">{g.row.clicks}</td>
                  <td className="py-2 pr-3 tabular-nums">{g.row.calls}</td>
                  <td className="py-2 pr-3 tabular-nums">{g.row.qualifiedCalls}</td>
                  <td className="py-2 pr-3 tabular-nums">{g.row.requests}</td>
                  <td className="py-2 pr-3 tabular-nums">{g.row.assigned}</td>
                  <td className="py-2 pr-3 tabular-nums">{g.row.completed}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(g.row.costPerRequestCents)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(g.row.costPerCompletedCents)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(g.row.feesCents)}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {g.row.roas === null ? "–" : `${g.row.roas.toFixed(2)}×`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
