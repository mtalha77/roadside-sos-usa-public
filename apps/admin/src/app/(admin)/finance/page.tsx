import { formatCurrency, type Locale } from "@rsos/i18n";
import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { StatCard } from "@rsos/ui/stat-card";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { demoLedger, demoRevenue } from "@/lib/finance";

export const dynamic = "force-dynamic";

const TABS = ["ledger", "revenue", "disputes", "stripe"] as const;
const KINDS = ["all", "fee", "top_up", "credit", "plan"] as const;
const card = "rounded-2xl border bg-card p-4 sm:p-5";

async function load() {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  const ledger = ctx.demo ? demoLedger(now, ctx.selected) : [];
  return { ctx, now, ledger, revenue: demoRevenue(now, ctx.selected, ledger) };
}

/**
 * Finance (RSOS-079): ledger explorer (top-ups, fees, credits, subscriptions), revenue by market,
 * service and source, disputes queue, Stripe reconciliation (placeholder) and CSV export. Demo data.
 */
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = TABS.find((x) => x === sp.tab) ?? "ledger";
  const kind = KINDS.find((x) => x === sp.kind) ?? "all";
  const [t, ts, locale, { ctx, ledger, revenue }] = await Promise.all([
    getTranslations("admin.finance"),
    getTranslations("site.services"),
    getLocale(),
    load(),
  ]);
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
  });
  const markets = Object.fromEntries(ctx.markets.map((m) => [m.slug, m.name]));
  const rows = (kind === "all" ? ledger : ledger.filter((x) => x.kind === kind)).slice(0, 100);
  const sum = (k: string) =>
    ledger.filter((x) => x.kind === k).reduce((a, x) => a + Math.abs(x.amountCents), 0);
  const disputes = ledger.filter((x) => x.kind === "credit");
  const bar = (list: [string, number][], label: (k: string) => string) => {
    const max = Math.max(1, ...list.map(([, v]) => v));
    return (
      <ul className="flex flex-col gap-2 text-sm">
        {list.map(([k, v]) => (
          <li key={k} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-2">
            <span className="truncate">{label(k)}</span>
            <span
              className="h-3 rounded-full bg-primary/70"
              style={{ width: `${Math.max(2, (v / max) * 100)}%` }}
            />
            <span className="text-right tabular-nums">{money(v)}</span>
          </li>
        ))}
      </ul>
    );
  };
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Button asChild variant="outline">
          <a href="/finance/export" download>
            {t("export")}
          </a>
        </Button>
      </header>
      {ctx.demo ? <p className="text-sm text-muted-foreground">{t("demo")}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("kinds.fee")} value={money(sum("fee"))} />
        <StatCard label={t("kinds.top_up")} value={money(sum("top_up"))} />
        <StatCard label={t("kinds.credit")} value={money(sum("credit"))} />
        <StatCard label={t("kinds.plan")} value={money(sum("plan"))} />
      </div>
      <nav aria-label={t("views")} className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((x) => (
          <Link
            key={x}
            href={`/finance?tab=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className="flex min-h-12 shrink-0 items-center border-b-2 border-transparent px-4 font-medium aria-[current=page]:border-primary"
          >
            {t(`tabs.${x}`)}
          </Link>
        ))}
      </nav>
      {tab === "ledger" ? (
        <>
          <nav aria-label={t("filter")} className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Link
                key={k}
                href={`/finance?tab=ledger&kind=${k}`}
                aria-current={k === kind ? "page" : undefined}
                className="flex min-h-12 items-center rounded-full border px-4 text-sm aria-[current=page]:bg-accent"
              >
                {k === "all" ? t("all") : t(`kinds.${k}`)}
              </Link>
            ))}
          </nav>
          <div
            tabIndex={0}
            role="region"
            aria-label={t("tabs.ledger")}
            className="overflow-x-auto rounded-2xl border bg-card"
          >
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">{t("tabs.ledger")}</caption>
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  {["date", "provider", "market", "type", "job", "amount"].map((k) => (
                    <th key={k} scope="col" className="px-4 py-3 font-medium">
                      {t(`cols.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td className="px-4 py-2 tabular-nums">{date.format(x.at)}</td>
                    <th scope="row" className="px-4 py-2 text-left font-medium">
                      {x.provider}
                    </th>
                    <td className="px-4 py-2">{markets[x.market] ?? x.market}</td>
                    <td className="px-4 py-2">{t(`kinds.${x.kind}`)}</td>
                    <td className="px-4 py-2">{x.job ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(x.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {tab === "revenue" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className={card} aria-labelledby="rm-h">
            <h2 id="rm-h" className="mb-3 font-semibold">
              {t("byMarket")}
            </h2>
            {bar(revenue.byMarket, (k) => markets[k] ?? k)}
          </section>
          <section className={card} aria-labelledby="rs-h">
            <h2 id="rs-h" className="mb-3 font-semibold">
              {t("byService")}
            </h2>
            {bar(revenue.byService, (k) => (ts.has(`${k}.name`) ? ts(`${k}.name`) : k))}
          </section>
          <section className={card} aria-labelledby="ro-h">
            <h2 id="ro-h" className="mb-3 font-semibold">
              {t("bySource")}
            </h2>
            {bar(revenue.bySource, (k) => (t.has(`sources.${k}`) ? t(`sources.${k}`) : k))}
          </section>
        </div>
      ) : null}
      {tab === "disputes" ? (
        disputes.length === 0 ? (
          <p className="text-muted-foreground">{t("noDisputes")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {disputes.slice(0, 30).map((x) => (
              <li
                key={x.id}
                className={`${card} flex flex-wrap items-center justify-between gap-2 text-sm`}
              >
                <span>
                  {x.provider} · {x.job ?? "—"} · {date.format(x.at)}
                </span>
                <span className="font-semibold tabular-nums">{money(x.amountCents)}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {tab === "stripe" ? <Alert tone="info" title={t("stripe")} /> : null}
    </main>
  );
}
