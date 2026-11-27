import { CHANNELS, SOURCES } from "@rsos/core/analytics-sources";
import { buildFunnel, type Scenario } from "@rsos/core/economics";
import { formatCurrency, formatNumber, type Locale } from "@rsos/i18n";
import { Badge } from "@rsos/ui/badge";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { type AnalyticsView, demoView, modelView, realView } from "@/lib/analytics";
import { demoNow } from "@/lib/demo-clock";
import { getModels } from "@/lib/economics";
import { BookingAnalytics } from "@/components/analytics/booking-analytics";
import { getMetricData, getServiceNames } from "@/lib/booking-metrics";
import { BookingFeeTable } from "@/components/booking/booking-fee-table";
import { getBookingFeeReport } from "@/lib/booking-report";

export const dynamic = "force-dynamic";

const RANGES = [1, 7, 30] as const;
const card = "rounded-2xl border bg-card p-4 sm:p-5";
/** Below this many real requests in the range, the Real view says there is not enough data yet. */
const ENOUGH_REAL = 20;

const Query = z.object({
  days: z.coerce
    .number()
    .refine((d) => (RANGES as readonly number[]).includes(d))
    .catch(7),
  view: z.enum(["real", "demo", "model"]).catch("real"),
  market: z.string().max(60).optional().catch(undefined),
  by: z.enum(["market", "source", "service", "device"]).catch("market"),
  test: z.enum(["1"]).optional().catch(undefined),
});

/**
 * Analytics (RSOS-081, rebuilt in RSOS-113). One kind of data at a time: Real (default in every
 * environment), Demo (staging and previews only, generated from the Economics model) or Model
 * (the model's estimate for the range). Every card is derived from the numbers below it and shows
 * the model's number for comparison. The funnel never lets a step pass the one before it.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, locale, ctx, now, jar, sp] = await Promise.all([
    getTranslations("admin.analytics"),
    getLocale(),
    getAdminContext(),
    demoNow(),
    cookies(),
    searchParams,
  ]);
  const q = Query.parse(sp);
  // Production never has Demo.
  const view = q.view === "demo" && !ctx.demo ? "real" : q.view;
  // Owner decision 2: test traffic stays out unless included on purpose, on staging only.
  const includeTest = ctx.demo && q.test === "1";
  const inView = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const markets = q.market ? inView.filter((m) => m.slug === q.market) : inView;
  const scenario: Scenario =
    view === "demo" && jar.get("rsos_demo_scenario")?.value === "strong" ? "strong" : "base";
  const models = (await getModels(ctx)).filter((m) => markets.some((x) => x.id === m.id));
  const model = modelView(models, q.days, scenario);
  const data: AnalyticsView =
    view === "model"
      ? model
      : view === "demo"
        ? demoView(models, q.days, scenario, now)
        : await realView(
            markets.map((m) => m.id),
            markets.map((m) => m.slug),
            models,
            q.days,
            now,
            includeTest,
          );
  // Booking funnel rows (RSOS-111): real only; the Demo view adds labelled demo rows.
  const serviceNames = await getServiceNames();
  const metrics =
    view === "model"
      ? null
      : await getMetricData({
          markets,
          services: Object.keys(serviceNames),
          from: now - q.days * 86_400_000,
          to: now,
          includeDemo: view === "demo",
          includeTest,
        });
  const l = locale as Locale;
  const money = (n: number | null) => (n === null ? "–" : formatCurrency(Math.round(n * 100), l));
  const count = (n: number) => formatNumber(Math.round(n), l, { maximumFractionDigits: 0 });
  const pct = (n: number | null) =>
    n === null ? "–" : formatNumber(n * 100, l, { maximumFractionDigits: 1 }) + "%";
  const funnel = buildFunnel(data.funnel);
  const tag =
    view === "demo" ? (
      <Badge tone="outline">{t("demoTag")}</Badge>
    ) : view === "model" ? (
      <Badge tone="info">{t("modelTag")}</Badge>
    ) : null;
  // "Better than the model" is green, "worse" red, close to it (within 2%) neutral.
  const versus = (actual: number | null, expected: number | null, lowerIsBetter = false) => {
    if (view === "model" || actual === null || expected === null || expected === 0)
      return "text-muted-foreground";
    const diff = (actual - expected) / Math.abs(expected);
    if (Math.abs(diff) < 0.02) return "text-muted-foreground";
    return diff > 0 !== lowerIsBetter ? "text-success-strong" : "text-critical-strong";
  };
  const cards: [string, string, string, string][] = [
    [
      "requests",
      count(data.requests),
      count(model.requests),
      versus(data.requests, model.requests),
    ],
    [
      "accepted",
      count(data.accepted),
      count(model.accepted),
      versus(data.accepted, model.accepted),
    ],
    [
      "adCostPerAccepted",
      money(data.adCostPerAccepted),
      money(model.adCostPerAccepted),
      versus(data.adCostPerAccepted, model.adCostPerAccepted, true),
    ],
    [
      "feeRevenue",
      money(data.feeRevenue),
      money(model.feeRevenue),
      versus(data.feeRevenue, model.feeRevenue),
    ],
    [
      "contribution",
      money(data.contribution),
      money(model.contribution),
      versus(data.contribution, model.contribution),
    ],
    ["profit", money(data.profit), money(model.profit), versus(data.profit, model.profit)],
  ];
  const link = (patch: Record<string, string | number | undefined>) => {
    const next = {
      days: q.days,
      view,
      market: q.market,
      by: q.by,
      test: includeTest ? "1" : undefined,
      ...patch,
    };
    const p = new URLSearchParams(
      Object.entries(next).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
    );
    return `/analytics?${p.toString()}`;
  };
  const chip =
    "inline-flex min-h-12 items-center rounded-full border px-4 text-sm aria-[current=page]:border-primary aria-[current=page]:bg-primary/10";
  const views = (["real", ...(ctx.demo ? ["demo"] : []), "model"] as const).filter(Boolean);
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <nav aria-label={t("viewLabel")} className="flex flex-wrap gap-2">
          {views.map((v) => (
            <Link
              key={v}
              href={link({ view: v })}
              aria-current={v === view ? "page" : undefined}
              className={chip}
            >
              {t(`views.${v}`)}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          <nav aria-label={t("range")} className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={link({ days: r })}
                aria-current={r === q.days ? "page" : undefined}
                className={chip}
              >
                {t("days", { count: r })}
              </Link>
            ))}
          </nav>
          <nav aria-label={t("marketLabel")} className="flex flex-wrap gap-2">
            <Link
              href={link({ market: undefined })}
              aria-current={!q.market ? "page" : undefined}
              className={chip}
            >
              {t("allMarkets")}
            </Link>
            {inView.map((m) => (
              <Link
                key={m.slug}
                href={link({ market: m.slug })}
                aria-current={q.market === m.slug ? "page" : undefined}
                className={chip}
              >
                {m.name}
              </Link>
            ))}
          </nav>
        </div>
        {ctx.demo && view === "real" ? (
          <p>
            <Link
              href={link({ test: includeTest ? undefined : "1" })}
              aria-current={includeTest ? "page" : undefined}
              className={chip}
            >
              {includeTest ? t("testOn") : t("testOff")}
            </Link>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {t(`viewNote.${view}`, { scenario: t(`scenarios.${scenario}`) })}
          {view === "real" && data.requests < ENOUGH_REAL ? ` ${t("notEnough")}` : ""}
        </p>
      </header>

      <section aria-labelledby="cards-h">
        <h2 id="cards-h" className="sr-only">
          {t("cardsTitle")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {cards.map(([k, value, expected, tone]) => (
            <div key={k} className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <dt className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                {t(`cards.${k}`)}
                {tag}
              </dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              {view === "model" ? null : (
                <dd className={`text-xs tabular-nums ${tone}`}>
                  {t("vsModel", { value: expected })}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </section>

      <section className={card} aria-labelledby="f-h">
        <h2 id="f-h" className="mb-1 flex items-center gap-2 font-semibold">
          {t("funnel")} {tag}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {t(view === "real" ? "funnelRealNote" : "funnelNote")}
        </p>
        {funnel.broken.length ? (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning-strong"
          >
            {t("dataWarning", { steps: funnel.broken.map((s) => t(`steps.${s}`)).join(", ") })}
          </p>
        ) : null}
        <ol className="flex flex-col gap-2 text-sm">
          {funnel.rows.map((r) => (
            <li
              key={r.step}
              className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 sm:grid-cols-[8rem_1fr_12rem]"
            >
              <span>{t(`steps.${r.step}`)}</span>
              <span
                aria-hidden="true"
                className="h-4 rounded-full bg-primary/70"
                style={{ width: `${Math.max(1, (r.fromFirst ?? (r.count ? 1 : 0)) * 100)}%` }}
              />
              <span
                className="text-right tabular-nums"
                title={
                  r.fromFirst === null ? undefined : t("ofVisits", { value: pct(r.fromFirst) })
                }
              >
                {count(r.count)}
                {r.fromPrevious !== null ? ` · ${pct(r.fromPrevious)}` : ""}
                <span className="sr-only">
                  {r.fromFirst !== null ? ` · ${t("ofVisits", { value: pct(r.fromFirst) })}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {metrics ? (
        <BookingAnalytics
          data={metrics}
          by={q.by}
          byLink={(by) => `${link({ by })}#bb-h`}
          tag={tag}
          names={{
            market: (slug) => inView.find((m) => m.slug === slug)?.name ?? slug,
            source: (s) => (t.has(`sources.${s}`) ? t(`sources.${s}` as never) : s),
            service: (s) => serviceNames[s] ?? s,
          }}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className={card} aria-labelledby="s-h">
          <h2 id="s-h" className="mb-3 flex items-center gap-2 font-semibold">
            {t("bySource")} {tag}
          </h2>
          <ul className="divide-y text-sm">
            {SOURCES.map((s) => (
              <li key={s} className="flex justify-between py-2">
                <span>{t(`sources.${s}`)}</span>
                <span className="tabular-nums">{count(data.sources[s] ?? 0)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2 font-semibold">
              <span>{t("total")}</span>
              <span className="tabular-nums">{count(data.requests)}</span>
            </li>
          </ul>
        </section>
        <section className={card} aria-labelledby="c-h">
          <h2 id="c-h" className="mb-3 flex items-center gap-2 font-semibold">
            {t("byChannel")} {tag}
          </h2>
          <ul className="divide-y text-sm">
            {CHANNELS.map((c) => (
              <li key={c} className="flex justify-between py-2">
                <span>{t(`channels.${c}`)}</span>
                <span className="tabular-nums">{count(data.channels[c] ?? 0)}</span>
              </li>
            ))}
            <li className="flex justify-between py-2 font-semibold">
              <span>{t("total")}</span>
              <span className="tabular-nums">{count(data.requests)}</span>
            </li>
          </ul>
        </section>
      </div>

      {/* RSOS-117: "Picked" and "Paid booking fee" per market, to compare test markets. */}
      <BookingFeeTable rows={await getBookingFeeReport(30)} markets={ctx.markets} money={false} />
      <section className={card} aria-labelledby="e-h">
        <h2 id="e-h" className="mb-3 flex items-center gap-2 font-semibold">
          {t("economics")} {tag}
        </h2>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
          {(
            [
              ["adSpend", data.adSpend],
              ["feeRevenue", data.feeRevenue],
              ["paymentFees", -data.paymentFees],
              ["subscriptions", data.subscriptions],
              ["contribution", data.contribution],
              ["fixedCosts", -data.fixedCosts],
              ["profit", data.profit],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className={k === "contribution" || k === "profit" ? "font-semibold" : undefined}>
                {t(`money.${k}`)}
              </dt>
              <dd
                className={`tabular-nums ${k === "contribution" || k === "profit" ? "font-semibold" : ""}`}
              >
                {money(k === "adSpend" ? -v : v)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {t(view === "real" ? "moneyRealNote" : "moneyModelNote")}{" "}
          <Link href="/economics" className="underline underline-offset-2">
            {t("editModel")}
          </Link>
        </p>
      </section>
    </main>
  );
}
