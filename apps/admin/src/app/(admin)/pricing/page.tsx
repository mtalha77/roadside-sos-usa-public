import { demoPlans } from "@rsos/config/demo-fixtures";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Badge } from "@rsos/ui/badge";
import { EmptyState } from "@rsos/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import { PriceChange } from "@/components/pricing/price-change";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  market_id: string;
  effective_from: string;
  enabled: boolean;
  platform_fee_cents: number | null;
  price_min_cents: number | null;
  price_max_cents: number | null;
  services: { slug: string; name: string } | null;
};

async function load() {
  const ctx = await getAdminContext();
  const supabase = await getServerSupabase();
  const ids = ctx.markets.filter((m) => ctx.selected.includes(m.slug)).map((m) => m.id);
  const { data } = await supabase
    .from("market_services")
    .select(
      "id, market_id, effective_from, enabled, platform_fee_cents, price_min_cents, price_max_cents, services(slug, name)",
    )
    .in("market_id", ids)
    .order("effective_from", { ascending: false });
  return { ctx, now: Date.now(), rows: (data ?? []) as unknown as Row[] };
}

/**
 * Pricing and fees (RSOS-078): per market and service the price range, provider price limits, our
 * fee, Pro discount and featured slot price; scheduled changes with an effective date, an approval
 * step and history. Ranges, fees and history are real (market_services).
 */
export default async function PricingPage() {
  const [t, ts, locale, { ctx, now, rows }] = await Promise.all([
    getTranslations("admin.pricing"),
    getTranslations("site.services"),
    getLocale(),
    load(),
  ]);
  const money = (c: number | null) => (c === null ? "—" : formatCurrency(c, locale as Locale));
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
  });
  const pro = demoPlans.find((p) => p.id === "pro")!;
  const featured = demoPlans.find((p) => p.id === "featured")!;
  const name = (r: Row) =>
    r.services
      ? ts.has(`${r.services.slug}.name`)
        ? ts(`${r.services.slug}.name`)
        : r.services.name
      : "";
  const markets = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {rows.length === 0 ? <EmptyState title={t("none")} /> : null}
      {markets.map((m) => {
        const mine = rows.filter((r) => r.market_id === m.id);
        if (!mine.length) return null;
        const seen = new Set<string>();
        const current: Row[] = [];
        const history: Row[] = [];
        const scheduled = mine.filter((r) => Date.parse(r.effective_from) > now);
        for (const r of mine.filter((x) => Date.parse(x.effective_from) <= now)) {
          const key = r.services?.slug ?? r.id;
          if (seen.has(key)) history.push(r);
          else {
            seen.add(key);
            current.push(r);
          }
        }
        return (
          <section key={m.id} aria-labelledby={`m-${m.slug}`} className="flex flex-col gap-3">
            <h2 id={`m-${m.slug}`} className="text-lg font-semibold">
              {m.name}
            </h2>
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full min-w-[44rem] text-sm">
                <caption className="sr-only">{t("current", { market: m.name })}</caption>
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    {["service", "range", "fee", "proFee", "featured", "since"].map((k) => (
                      <th key={k} scope="col" className="px-4 py-3 font-medium">
                        {t(`cols.${k}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {current.map((r) => (
                    <tr key={r.id}>
                      <th scope="row" className="px-4 py-2 text-left font-semibold">
                        {name(r)} {r.enabled ? null : <Badge tone="neutral">{t("off")}</Badge>}
                      </th>
                      <td className="px-4 py-2 tabular-nums">
                        {t("rangeValue", {
                          min: money(r.price_min_cents),
                          max: money(r.price_max_cents),
                        })}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{money(r.platform_fee_cents)}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {r.platform_fee_cents === null
                          ? "—"
                          : money(
                              Math.round(r.platform_fee_cents * (1 - pro.feeDiscountPct / 100)),
                            )}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {t("perMonth", { price: money(featured.monthlyCents) })}
                      </td>
                      <td className="px-4 py-2 tabular-nums">
                        {date.format(Date.parse(r.effective_from))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {scheduled.length ? (
              <p className="text-sm">{t("scheduledCount", { count: scheduled.length })}</p>
            ) : null}
            {history.length ? (
              <details className="rounded-2xl border bg-card p-4 text-sm">
                <summary className="flex min-h-12 cursor-pointer items-center font-medium">
                  {t("history", { count: history.length })}
                </summary>
                <ul className="mt-2 divide-y">
                  {history.map((r) => (
                    <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span>{name(r)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {t("historyRow", {
                          min: money(r.price_min_cents),
                          max: money(r.price_max_cents),
                          fee: money(r.platform_fee_cents),
                          date: date.format(Date.parse(r.effective_from)),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <PriceChange
              market={m.name}
              services={current.map((r) => ({ id: r.id, name: name(r) }))}
              canApprove={ctx.role === "super_admin"}
              labels={Object.fromEntries(
                [
                  "schedule",
                  "service",
                  "min",
                  "max",
                  "fee",
                  "effective",
                  "submit",
                  "pending",
                  "approve",
                  "approved",
                  "needsApproval",
                  "invalid",
                  "to",
                ].map((k) => [k, t(`change.${k}`)]),
              )}
            />
          </section>
        );
      })}
      <p className="text-sm text-muted-foreground">{t("plansNote")}</p>
    </main>
  );
}
