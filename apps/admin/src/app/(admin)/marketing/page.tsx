import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { SpendForm } from "@/components/marketing/spend-form";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border bg-card p-4 sm:p-5";
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Marketing (RSOS-031): per market and source for a date range, visits, calls, qualified calls,
 * forms, requests, assigned and completed jobs, ad spend and the cost of each. Spend is entered
 * by hand until the ad APIs are connected; the Google Ads offline conversion file downloads here.
 */
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [t, ctx, sp] = await Promise.all([
    getTranslations("admin.marketing"),
    getAdminContext(),
    searchParams,
  ]);
  const today = new Date();
  const from =
    z.iso.date().safeParse(sp.from).data ?? iso(new Date(today.getTime() - 13 * 86_400_000));
  const to = z.iso.date().safeParse(sp.to).data ?? iso(today);
  const { data: rows } = await (
    await getServerSupabase()
  ).rpc("marketing_report", {
    p_from: from,
    p_to: to,
  });
  const money = (c: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
  const per = (spend: number, n: number) => (spend > 0 && n > 0 ? money(spend / n) : "—");
  const market = (slug: string) => ctx.markets.find((m) => m.slug === slug)?.name ?? slug;
  const visible = (rows ?? []).filter((r) => ctx.selected.includes(r.market_slug));
  const total = visible.reduce(
    (a, r) => ({
      spend: a.spend + Number(r.spend_cents),
      requests: a.requests + Number(r.requests),
      completed: a.completed + Number(r.completed),
    }),
    { spend: 0, requests: 0, completed: 0 },
  );
  const canSpend = ctx.role === "super_admin" || ctx.role === "marketing";
  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("from")}
          <input type="date" name="from" defaultValue={from} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("to")}
          <input type="date" name="to" defaultValue={to} className={inputClass} />
        </label>
        <button
          type="submit"
          className="min-h-touch rounded-lg border px-4 font-medium hover:bg-accent"
        >
          {t("apply")}
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        {t("summary", {
          spend: money(total.spend),
          perRequest: per(total.spend, total.requests),
          perCompleted: per(total.spend, total.completed),
        })}
      </p>
      <section className={card} aria-labelledby="mk-h">
        <h2 id="mk-h" className="mb-3 font-semibold">
          {t("bySource")}
        </h2>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div tabIndex={0} role="region" aria-labelledby="mk-h" className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="border-b text-left">
                  {(
                    [
                      "market",
                      "source",
                      "visits",
                      "calls",
                      "qualified",
                      "forms",
                      "requests",
                      "assigned",
                      "completed",
                      "spend",
                      "perRequest",
                      "perCompleted",
                    ] as const
                  ).map((c) => (
                    <th key={c} scope="col" className="py-2 pr-3 font-medium">
                      {t(`cols.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((r) => (
                  <tr key={`${r.market_slug}-${r.source}`}>
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {market(r.market_slug)}
                    </th>
                    <td className="py-2 pr-3">{r.source}</td>
                    {[
                      r.visits,
                      r.calls,
                      r.qualified_calls,
                      r.forms,
                      r.requests,
                      r.assigned,
                      r.completed,
                    ].map((n, i) => (
                      <td key={i} className="py-2 pr-3 tabular-nums">
                        {Number(n)}
                      </td>
                    ))}
                    <td className="py-2 pr-3 tabular-nums">{money(Number(r.spend_cents))}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {per(Number(r.spend_cents), Number(r.requests))}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {per(Number(r.spend_cents), Number(r.completed))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {canSpend ? (
          <section className={card} aria-labelledby="sp-h">
            <h2 id="sp-h" className="mb-3 font-semibold">
              {t("spendTitle")}
            </h2>
            <SpendForm
              markets={ctx.markets
                .filter((m) => ctx.selected.includes(m.slug))
                .map((m) => ({ value: m.slug, label: m.name }))}
              today={iso(today)}
              inputClass={inputClass}
            />
          </section>
        ) : null}
        <section className={card} aria-labelledby="oc-h">
          <h2 id="oc-h" className="mb-2 font-semibold">
            {t("offlineTitle")}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">{t("offlineBody")}</p>
          <form
            method="get"
            action="/api/marketing/offline-conversions"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("day")}
              <input
                type="date"
                name="day"
                defaultValue={iso(new Date(today.getTime() - 86_400_000))}
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              className="min-h-touch rounded-lg border px-4 font-medium hover:bg-accent"
            >
              {t("download")}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
