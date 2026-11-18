import { type EconomicsResult, SCENARIOS } from "@rsos/core/economics";
import { formatCurrency, formatDateTime, formatNumber, type Locale } from "@rsos/i18n";
import { EmptyState } from "@rsos/ui/empty-state";
import { CheckSquare, Square } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { EconomicsForm } from "@/components/economics/economics-form";
import { getAdminContext } from "@/lib/admin";
import { getModelHistory, getModels, modelTable } from "@/lib/economics";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FORM_KEYS = [
  "budget",
  "cpc",
  "clickToRequest",
  "acceptance",
  "paymentFees",
  "subscriptions",
  "fixed",
  "usd",
  "usdMonth",
  "mixAndFees",
  "mix",
  "fee",
  "assumptions",
  "assumptionsHint",
  "startToSubmit",
  "quoteRate",
  "completionRate",
  "save",
  "saved",
  "error.invalid",
  "error.mix",
  "error.save",
  "error.forbidden",
] as const;

/**
 * Economics model (RSOS-113): the owner's per-market inputs for the base and strong scenarios,
 * the results side by side (clicks, requests, accepted, fee revenue, contribution, profit, ad cost
 * per accepted request, break-even), a "fixed costs shared across markets" toggle and the change
 * history. Owners and operations managers edit; Analytics reads it for its Model view.
 */
export default async function EconomicsPage({
  searchParams,
}: {
  searchParams: Promise<{ shared?: string }>;
}) {
  const [t, locale, ctx, sp] = await Promise.all([
    getTranslations("admin.economics"),
    getLocale(),
    getAdminContext(),
    searchParams,
  ]);
  const shared = sp.shared === "1";
  const [models, { data: services }] = await Promise.all([
    getModels(ctx),
    (await getServerSupabase()).from("services").select("slug, name").order("sort_order"),
  ]);
  const table = modelTable(models, shared);
  const history = await getModelHistory(models.map((m) => m.id));
  const l = locale as Locale;
  const usd = (n: number) => formatCurrency(Math.round(n * 100), l);
  const usdCents = (n: number | null) =>
    n === null ? "–" : formatCurrency(Math.round(n * 100), l);
  const count = (n: number | null) =>
    n === null ? "–" : formatNumber(Math.round(n), l, { maximumFractionDigits: 0 });
  const editable = ctx.role === "super_admin" || ctx.role === "ops_manager";
  const cols: [keyof EconomicsResult, (v: number | null) => string][] = [
    ["clicks", count],
    ["requests", count],
    ["accepted", count],
    ["feeRevenue", (v) => usd(v ?? 0)],
    ["contribution", (v) => usd(v ?? 0)],
    ["profit", (v) => usd(v ?? 0)],
    ["adCostPerAccepted", usdCents],
    ["breakEvenAccepted", count],
  ];
  const svc = (services ?? []).map((s) => [s.slug, s.name] as [string, string]);
  const formLabels = Object.fromEntries(FORM_KEYS.map((k) => [k, t(`form.${k}`)]));
  const name = new Map(models.map((m) => [m.id, m.name]));
  // Times in each market's own time zone.
  const when = (at: string, marketId: string) =>
    formatDateTime(new Date(at), l, ctx.markets.find((m) => m.id === marketId)?.timeZone ?? "UTC");
  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <Link
          href={shared ? "/economics" : "/economics?shared=1"}
          aria-pressed={shared}
          className="inline-flex min-h-12 items-center gap-2 rounded-lg border px-4 text-sm font-medium hover:bg-accent aria-pressed:border-primary aria-pressed:bg-primary/10"
        >
          {shared ? (
            <CheckSquare aria-hidden="true" className="size-5" />
          ) : (
            <Square aria-hidden="true" className="size-5" />
          )}
          {t("shared")}
        </Link>
      </header>

      {models.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("empty")} />
      ) : (
        <section aria-labelledby="res-h" className="flex flex-col gap-2">
          <h2 id="res-h" className="text-lg font-semibold">
            {t("results")}
          </h2>
          <div className="overflow-x-auto rounded-xl border" tabIndex={0} aria-labelledby="res-h">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 text-left text-muted-foreground">
                <tr className="h-9">
                  <th scope="col" className="px-3 font-medium">
                    {t("market")}
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    {t("scenario")}
                  </th>
                  {cols.map(([k]) => (
                    <th key={k} scope="col" className="px-3 text-right font-medium">
                      {t(`cols.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.rows
                  .sort(
                    (a, b) =>
                      a.market.name.localeCompare(b.market.name) ||
                      a.scenario.localeCompare(b.scenario),
                  )
                  .map(({ market, scenario, result }) => (
                    <tr key={`${market.id}-${scenario}`} className="h-9 tabular-nums">
                      <th scope="row" className="px-3 text-left font-medium">
                        {market.name}
                      </th>
                      <td className="px-3">{t(`scenarios.${scenario}`)}</td>
                      {cols.map(([k, f]) => (
                        <td
                          key={k}
                          className={`px-3 text-right ${k === "profit" && result.profit < 0 ? "text-critical-strong" : ""}`}
                        >
                          {f(result[k] as number | null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                {SCENARIOS.map((s) =>
                  table.totals[s] ? (
                    <tr key={`total-${s}`} className="h-9 bg-muted/40 font-semibold tabular-nums">
                      <th scope="row" className="px-3 text-left">
                        {t("allMarkets")}
                      </th>
                      <td className="px-3">{t(`scenarios.${s}`)}</td>
                      {cols.map(([k, f]) => (
                        <td key={k} className="px-3 text-right">
                          {f(table.totals[s]![k] as number | null)}
                        </td>
                      ))}
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {shared ? t("sharedOn") : t("sharedOff")} {t("formula")}
          </p>
        </section>
      )}

      {editable
        ? models.map((m) => (
            <section
              key={m.id}
              aria-labelledby={`m-${m.slug}`}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5"
            >
              <h2 id={`m-${m.slug}`} className="text-lg font-semibold">
                {m.name}
              </h2>
              {SCENARIOS.map((s) => (
                <details key={s} className="rounded-xl border p-3" open={s === "base"}>
                  <summary className="min-h-10 cursor-pointer font-semibold">
                    {t(`scenarios.${s}`)}
                    {m.updatedAt[s] ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {t("updated", { at: when(m.updatedAt[s]!, m.id) })}
                      </span>
                    ) : null}
                  </summary>
                  <div className="pt-3">
                    <EconomicsForm
                      marketId={m.id}
                      scenario={s}
                      inputs={m.inputs[s] ?? m.inputs.base ?? null}
                      services={svc}
                      labels={formLabels}
                    />
                  </div>
                </details>
              ))}
            </section>
          ))
        : null}

      {history.length ? (
        <section aria-labelledby="h-h" className="flex flex-col gap-2">
          <h2 id="h-h" className="text-lg font-semibold">
            {t("history")}
          </h2>
          <ul className="divide-y rounded-xl border text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span>
                  {name.get(h.marketId)} ·{" "}
                  {t(`scenarios.${h.scenario === "strong" ? "strong" : "base"}`)}
                </span>
                <span className="text-muted-foreground">
                  {h.by ?? t("seeded")} · {when(h.at, h.marketId)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
