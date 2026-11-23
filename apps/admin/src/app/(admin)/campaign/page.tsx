import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { BookingAnalytics } from "@/components/analytics/booking-analytics";
import { getAdminContext } from "@/lib/admin";
import { getMetricData, getServiceNames } from "@/lib/booking-metrics";
import { loadCampaign } from "@/lib/campaign";
import { demoNow } from "@/lib/demo-clock";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border bg-card p-4 sm:p-5";

/**
 * Test campaign (RSOS-089-prep): per market over the campaign window, requests, calls, answer
 * rate, time to first contact, time to provider assigned, fill and completion rates, average
 * quoted price, fees that would have been earned, and cost per request and per completed job.
 */
export default async function CampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; by?: string }>;
}) {
  const sp = await searchParams;
  const days = z.coerce.number().int().min(1).max(90).catch(14).parse(sp.days);
  const by = z.enum(["market", "source", "service", "device"]).catch("market").parse(sp.by);
  const [t, ta, rows, ctx, now, serviceNames] = await Promise.all([
    getTranslations("admin.campaign"),
    getTranslations("admin.analytics"),
    loadCampaign(days),
    getAdminContext(),
    demoNow(),
    getServiceNames(),
  ]);
  // The booking funnel over the campaign window (RSOS-111): real requests only.
  const inView = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const metrics = await getMetricData({
    markets: inView,
    services: Object.keys(serviceNames),
    from: now - days * 86_400_000,
    to: now,
    includeDemo: false,
  });
  const usd = (c: number | null) =>
    c === null
      ? "—"
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
  const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
  const mins = (m: number | null) => (m === null ? "—" : t("minutes", { m }));
  const cols = [
    ["requests", (r: (typeof rows)[number]) => String(r.requests)],
    ["calls", (r: (typeof rows)[number]) => String(r.calls)],
    ["answerRate", (r: (typeof rows)[number]) => pct(r.answerRate)],
    ["toContact", (r: (typeof rows)[number]) => mins(r.minutesToContact)],
    ["toAssigned", (r: (typeof rows)[number]) => mins(r.minutesToAssigned)],
    ["fillRate", (r: (typeof rows)[number]) => pct(r.fillRate)],
    ["completionRate", (r: (typeof rows)[number]) => pct(r.completionRate)],
    ["avgPrice", (r: (typeof rows)[number]) => usd(r.avgQuotedPriceCents)],
    ["fees", (r: (typeof rows)[number]) => usd(r.feesCents)],
    ["spend", (r: (typeof rows)[number]) => usd(r.spendCents)],
    ["perRequest", (r: (typeof rows)[number]) => usd(r.costPerRequestCents)],
    ["perCompleted", (r: (typeof rows)[number]) => usd(r.costPerCompletedCents)],
  ] as const;
  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro", { days })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form method="get" className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("days")}
              <input
                type="number"
                name="days"
                min={1}
                max={90}
                defaultValue={days}
                className="min-h-touch w-24 rounded-lg border bg-background px-3"
              />
            </label>
            <button
              type="submit"
              className="min-h-touch rounded-lg border px-4 font-medium hover:bg-accent"
            >
              {t("apply")}
            </button>
          </form>
          <a
            href={`/api/campaign/export?days=${days}`}
            className="inline-flex min-h-touch items-center rounded-lg border px-4 font-medium hover:bg-accent"
          >
            {t("export")}
          </a>
        </div>
      </div>
      <section className={card} aria-labelledby="cp-h">
        <h2 id="cp-h" className="mb-3 font-semibold">
          {t("byMarket")}
        </h2>
        <div tabIndex={0} role="region" aria-labelledby="cp-h" className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t("cols.market")}
                </th>
                {cols.map(([k]) => (
                  <th key={k} scope="col" className="py-2 pr-3 font-medium">
                    {t(`cols.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.marketId}>
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {r.market}
                  </th>
                  {cols.map(([k, f]) => (
                    <td key={k} className="py-2 pr-3 tabular-nums">
                      {f(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("note")}</p>
      </section>
      <BookingAnalytics
        data={metrics}
        by={by}
        byLink={(b) => `/campaign?days=${days}&by=${b}#bb-h`}
        names={{
          market: (slug) => inView.find((m) => m.slug === slug)?.name ?? slug,
          source: (s) => (ta.has(`sources.${s}`) ? ta(`sources.${s}` as never) : s),
          service: (s) => serviceNames[s] ?? s,
        }}
      />
    </main>
  );
}
