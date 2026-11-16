import { formatCurrency, type Locale } from "@rsos/i18n";
import { StatCard } from "@rsos/ui/stat-card";
import { getLocale, getTranslations } from "next-intl/server";
import { card, PageHead, pageMain } from "@/components/shell/page-head";
import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  const { data } = await getPortalData(ctx, Date.now());
  return { ctx, data };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Performance insights (RSOS-061): quote and win rates, reply time, ETA accuracy, rating,
 * cancellations, and return on fees by week. Charts are plain SVG (no client JavaScript).
 */
export default async function InsightsPage() {
  const [t, locale, { ctx, data }] = await Promise.all([
    getTranslations("portal.insights"),
    getLocale(),
    load(),
  ]);
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const weeks = data.weeks;
  const quotes = weeks.reduce((a, w) => a + w.quotes, 0);
  const wins = weeks.reduce((a, w) => a + w.wins, 0);
  const value = weeks.reduce((a, w) => a + w.jobValueCents, 0);
  const fees = weeks.reduce((a, w) => a + w.feesCents, 0);
  const offered = quotes + data.offers.length + Math.round(quotes * 0.25);
  const reply = Math.round(weeks.reduce((a, w) => a + w.replySec, 0) / Math.max(1, weeks.length));
  const eta = weeks.reduce((a, w) => a + w.etaAccuracy, 0) / Math.max(1, weeks.length);
  const cancelled = data.history.filter((j) => j.status === "cancelled").length;
  const max = Math.max(1, ...weeks.map((w) => w.jobValueCents));
  const day = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "short",
    day: "numeric",
  });
  const W = 640;
  const H = 220;
  const bw = W / Math.max(1, weeks.length);
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label={t("quoteRate")} value={pct(quotes / Math.max(1, offered))} />
        <StatCard label={t("winRate")} value={pct(wins / Math.max(1, quotes))} />
        <StatCard label={t("reply")} value={t("seconds", { s: reply })} />
        <StatCard label={t("eta")} value={pct(eta)} />
        <StatCard
          label={t("rating")}
          value={data.provider.rating === null ? t("noRating") : data.provider.rating.toFixed(1)}
        />
        <StatCard label={t("cancellations")} value={String(cancelled)} />
      </div>
      {ctx.canSeeMoney ? (
        <section className={card} aria-labelledby="roi-h">
          <h2 id="roi-h" className="font-semibold">
            {t("roi")}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("roiSummary", {
              value: money(value),
              fees: money(fees),
              ratio: fees ? (value / fees).toFixed(1) : "0",
            })}
          </p>
          <svg
            viewBox={`0 0 ${W} ${H + 24}`}
            role="img"
            aria-labelledby="roi-h"
            className="h-auto w-full"
          >
            {weeks.map((w, i) => {
              const h = (w.jobValueCents / max) * H;
              const f = (w.feesCents / max) * H;
              return (
                <g key={w.weekStart}>
                  <rect
                    x={i * bw + 8}
                    y={H - h}
                    width={bw - 16}
                    height={h}
                    rx={4}
                    className="fill-primary/70"
                  />
                  <rect
                    x={i * bw + 8}
                    y={H - f}
                    width={bw - 16}
                    height={f}
                    rx={4}
                    className="fill-warning"
                  />
                  <text
                    x={i * bw + bw / 2}
                    y={H + 18}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[12px]"
                  >
                    {day.format(w.weekStart)}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-2 flex gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-sm bg-primary/70" />
              {t("value")}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-sm bg-warning" />
              {t("fees")}
            </span>
          </p>
          <table className="sr-only">
            <caption>{t("roi")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("week")}</th>
                <th scope="col">{t("value")}</th>
                <th scope="col">{t("fees")}</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.weekStart}>
                  <th scope="row">{day.format(w.weekStart)}</th>
                  <td>{money(w.jobValueCents)}</td>
                  <td>{money(w.feesCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {ctx.demo ? <p className="text-sm text-muted-foreground">{t("demo")}</p> : null}
    </main>
  );
}
