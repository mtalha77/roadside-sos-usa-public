import { canSee } from "@rsos/config/permissions";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Badge } from "@rsos/ui/badge";
import { EmptyState } from "@rsos/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { AutoRefresh } from "@/components/today/auto-refresh";
import { getAdminContext } from "@/lib/admin";
import { formatAge } from "@/lib/board-time";
import { demoNow } from "@/lib/demo-clock";
import { getToday } from "@/lib/today";

export const dynamic = "force-dynamic";

/**
 * Today (RSOS-103, replaces the overview): what needs a person now, the ten most urgent items with
 * one action each, today's numbers per market and alerts. Calm and small: no decorative charts.
 */
export default async function TodayPage() {
  const [t, td, locale, ctx, now] = await Promise.all([
    getTranslations("admin"),
    getTranslations("admin.today"),
    getLocale(),
    getAdminContext(),
    demoNow(),
  ]);
  const today = await getToday(ctx, now);
  const stale = { stale: t("dispatch.stale") };
  const age = (since: number) => formatAge(now - since, stale);
  const money = canSee(ctx.role, "finance");
  const name = (slug: string) => ctx.markets.find((m) => m.slug === slug)?.name ?? slug;
  const strip = [
    {
      label: td("strip.needAction"),
      value: today.needAction,
      hint:
        today.oldestWaiting !== null
          ? td("strip.oldest", { age: age(today.oldestWaiting) })
          : td("strip.none"),
      tone: today.needAction ? "warning" : null,
    },
    { label: td("strip.missedCalls"), value: today.missedCalls, hint: td("strip.last24h") },
    { label: td("strip.noQuote"), value: today.noQuote, hint: td("strip.noQuoteHint") },
    {
      // Online now where presence is known (demo supply); otherwise verified providers.
      label: today.days.some((d) => d.online !== null) ? td("strip.online") : td("strip.verified"),
      value: today.days.reduce((n, d) => n + (d.online ?? d.verified), 0),
      hint: today.days.map((d) => `${d.name} ${d.online ?? d.verified}`).join(" · "),
    },
  ];
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <AutoRefresh />
      <header>
        <h1 className="text-2xl font-semibold">{t("sections.today")}</h1>
        <p className="text-sm text-muted-foreground">{td("lead")}</p>
      </header>

      <section aria-labelledby="strip-h">
        <h2 id="strip-h" className="sr-only">
          {td("strip.title")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {strip.map((s) => (
            <div
              key={s.label}
              className={`flex flex-col gap-1 rounded-xl border bg-card p-4 ${s.tone === "warning" ? "border-warning" : ""}`}
            >
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
              <dd className="truncate text-xs text-muted-foreground">{s.hint}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="urgent-h" className="flex flex-col gap-2">
          <h2 id="urgent-h" className="text-lg font-semibold">
            {td("urgent.title")}
          </h2>
          {today.urgent.length === 0 ? (
            <EmptyState title={td("urgent.emptyTitle")} description={td("urgent.empty")} />
          ) : (
            <ol className="divide-y rounded-xl border bg-card">
              {today.urgent.map((u) => (
                <li key={`${u.reason}-${u.id}`} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="tabular-nums">{u.code}</span>
                      {u.demo ? <Badge tone="outline">{t("dispatch.demo")}</Badge> : null}
                      <span className="text-sm font-normal text-muted-foreground">
                        {td(`reasons.${u.reason}`)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {name(u.market)} · <span className="tabular-nums">{age(u.since)}</span>
                    </p>
                  </div>
                  <Link
                    href={u.href}
                    className="inline-flex min-h-12 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {td(`do.${u.action}`)}
                    <span className="sr-only"> {u.code}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="alerts-h" className="flex flex-col gap-2">
          <h2 id="alerts-h" className="text-lg font-semibold">
            {td("alerts.title")}
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {today.alerts.stale ? (
              <li className="rounded-xl border border-warning bg-warning-subtle px-4 py-3 text-warning-strong">
                <Link href="/dispatch" className="underline-offset-2 hover:underline">
                  {td("alerts.stale", { count: today.alerts.stale })}
                </Link>
              </li>
            ) : null}
            {today.alerts.emptyMarkets.map((m) => (
              <li
                key={m}
                className="rounded-xl border border-critical bg-critical-subtle px-4 py-3 text-critical-strong"
              >
                {td("alerts.noProviders", { market: m })}
              </li>
            ))}
            {!today.alerts.stale && !today.alerts.emptyMarkets.length ? (
              <li className="rounded-xl border px-4 py-3 text-muted-foreground">
                {td("alerts.none")}
              </li>
            ) : null}
            <li className="px-1 text-xs text-muted-foreground">{td("alerts.webhooks")}</li>
          </ul>
        </section>
      </div>

      <section aria-labelledby="numbers-h" className="flex flex-col gap-2">
        <h2 id="numbers-h" className="text-lg font-semibold">
          {td("numbers.title")}
        </h2>
        <div className="overflow-x-auto rounded-xl border" tabIndex={0} aria-labelledby="numbers-h">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-muted-foreground">
              <tr className="h-9">
                <th scope="col" className="px-3 font-medium">
                  {td("numbers.market")}
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  {td("numbers.requests")}
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  {td("numbers.fill")}
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  {td("numbers.assign")}
                </th>
                <th scope="col" className="px-3 text-right font-medium">
                  {td("numbers.completed")}
                </th>
                {money ? (
                  <th scope="col" className="px-3 text-right font-medium">
                    {td("numbers.fees")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {today.days.map((d) => (
                <tr key={d.slug} className="h-9 tabular-nums">
                  <th scope="row" className="px-3 text-left font-medium">
                    {d.name}
                  </th>
                  <td className="px-3 text-right">{d.requests}</td>
                  <td className="px-3 text-right">
                    {d.requests ? `${Math.round((d.filled / d.requests) * 100)}%` : "–"}
                  </td>
                  <td className="px-3 text-right">
                    {d.medianAssignMs === null ? "–" : formatAge(d.medianAssignMs, stale)}
                  </td>
                  <td className="px-3 text-right">{d.completed}</td>
                  {money ? (
                    <td className="px-3 text-right">
                      {formatCurrency(d.feesCents, locale as Locale)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{td("numbers.note")}</p>
      </section>
    </main>
  );
}
