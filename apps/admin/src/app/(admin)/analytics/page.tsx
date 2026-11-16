import { demoMarkets, unitEconomics } from "@rsos/config/demo-fixtures";
import { DEMO_LIFETIME_SEC, demoState, demoStream } from "@rsos/core/demo";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { StatCard } from "@rsos/ui/stat-card";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RANGES = [1, 7, 30] as const;
const card = "rounded-2xl border bg-card p-4 sm:p-5";
const DAY = 86_400_000;

async function load(days: number) {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  const supabase = await getServerSupabase();
  const since = new Date(now - days * DAY).toISOString();
  const ids = ctx.markets.filter((m) => ctx.selected.includes(m.slug)).map((m) => m.id);
  const { count: realRequests } = await supabase
    .from("requests")
    .select("id", { count: "exact", head: true })
    .in("market_id", ids)
    .neq("status", "draft")
    .gte("created_at", since);
  // Demo: the stream gives ~1 request per market every 75 s; scale the live window to the range.
  const live = ctx.demo
    ? demoStream(now, { markets: ctx.selected.filter((m) => demoMarkets[m]) })
    : [];
  const scale = (days * 86_400) / DEMO_LIFETIME_SEC;
  return { ctx, now, live, scale, realRequests: realRequests ?? 0 };
}

/**
 * Analytics (RSOS-081): funnel per market and source, speed (time to first quote, ETA accuracy),
 * supply by hour and economics. Demo data plus the real request count; economics use placeholder
 * assumptions from packages/config until the unit economics model is shared.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.days) ?? 7;
  const [t, locale, { ctx, now, live, scale, realRequests }] = await Promise.all([
    getTranslations("admin.analytics"),
    getLocale(),
    load(days),
  ]);
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const states = live.map((r) => ({ r, s: demoState(r, now) }));
  const submitted = Math.round(live.length * scale);
  const quoted = Math.round(states.filter((x) => x.s.quotes.length > 0).length * scale);
  const picked = Math.round(states.filter((x) => x.s.picked).length * scale);
  const completed = Math.round(
    states.filter((x) => x.s.stage === "completed" || x.r.outcome === "completed").length * scale,
  );
  const started = Math.round(submitted / unitEconomics.startToSubmit);
  const visits = Math.round(started / unitEconomics.visitToStart);
  const funnel = [
    ["visits", visits],
    ["started", started],
    ["submitted", submitted],
    ["quoted", quoted],
    ["picked", picked],
    ["completed", completed],
  ] as const;
  const firstQuote = states
    .map((x) => x.s.quotes[0]?.arrivesAtSec)
    .filter((v): v is number => v !== undefined);
  const avgFirst = firstQuote.length
    ? Math.round(firstQuote.reduce((a, b) => a + b, 0) / firstQuote.length)
    : 0;
  const paidRequests = Math.round(submitted * unitEconomics.paidShare);
  const adSpend = Math.round(
    (paidRequests / unitEconomics.clickToRequest) * unitEconomics.costPerClickCents,
  );
  const feeRevenue =
    states
      .filter((x) => x.s.picked)
      .reduce((a, x) => a + Math.round(x.s.picked!.priceCents * unitEconomics.feeShareOfPrice), 0) *
    scale;
  const bySource = new Map<string, number>();
  for (const { r } of states) bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
  const maxFunnel = Math.max(1, visits);
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <nav aria-label={t("range")} className="flex gap-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/analytics?days=${r}`}
              aria-current={r === days ? "page" : undefined}
              className="flex min-h-12 items-center rounded-full border px-4 text-sm aria-[current=page]:bg-accent"
            >
              {t("days", { count: r })}
            </Link>
          ))}
        </nav>
      </header>
      {ctx.demo ? (
        <p className="text-sm text-muted-foreground">{t("demo", { real: realRequests })}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("realRequests")} value={String(realRequests)} />
        <StatCard label={t("firstQuote")} value={t("seconds", { s: avgFirst })} />
        <StatCard
          label={t("costPerRequest")}
          value={money(paidRequests ? Math.round(adSpend / paidRequests) : 0)}
        />
        <StatCard label={t("contribution")} value={money(Math.round(feeRevenue - adSpend))} />
      </div>
      <section className={card} aria-labelledby="f-h">
        <h2 id="f-h" className="mb-3 font-semibold">
          {t("funnel")}
        </h2>
        <ol className="flex flex-col gap-2 text-sm">
          {funnel.map(([k, v], i) => (
            <li key={k} className="grid grid-cols-[7rem_1fr_7rem] items-center gap-2">
              <span>{t(`steps.${k}`)}</span>
              <span
                className="h-4 rounded-full bg-primary/70"
                style={{ width: `${Math.max(1, (v / maxFunnel) * 100)}%` }}
              />
              <span className="text-right tabular-nums">
                {v.toLocaleString(locale)}
                {i > 0 && funnel[i - 1]![1]
                  ? ` · ${Math.round((v / funnel[i - 1]![1]) * 100)}%`
                  : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="s-h">
          <h2 id="s-h" className="mb-3 font-semibold">
            {t("bySource")}
          </h2>
          <ul className="divide-y text-sm">
            {[...bySource].map(([k, n]) => (
              <li key={k} className="flex justify-between py-2">
                <span>{t.has(`sources.${k}`) ? t(`sources.${k}`) : k}</span>
                <span className="tabular-nums">{Math.round(n * scale).toLocaleString(locale)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={card} aria-labelledby="e-h">
          <h2 id="e-h" className="mb-3 font-semibold">
            {t("economics")}
          </h2>
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
            <dt>{t("adSpend")}</dt>
            <dd className="tabular-nums">{money(adSpend)}</dd>
            <dt>{t("feeRevenue")}</dt>
            <dd className="tabular-nums">{money(Math.round(feeRevenue))}</dd>
            <dt>{t("contribution")}</dt>
            <dd className="tabular-nums font-semibold">
              {money(Math.round(feeRevenue - adSpend))}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{t("assumptions")}</p>
        </section>
      </div>
    </main>
  );
}
