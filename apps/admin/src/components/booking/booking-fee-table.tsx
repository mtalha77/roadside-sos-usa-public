import { formatCurrency, type Locale } from "@rsos/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import type { BookingFeeRow } from "@/lib/booking-report";

/**
 * Picked and "Paid booking fee" per market (RSOS-117), with refunds and net booking fee revenue.
 * Used on Finance (money) and Analytics (the funnel step), so test markets can be compared.
 */
export async function BookingFeeTable({
  rows,
  markets,
  money: showMoney,
}: {
  rows: BookingFeeRow[];
  markets: { id: string; name: string }[];
  money: boolean;
}) {
  const [t, locale] = await Promise.all([getTranslations("admin.bookingFees"), getLocale()]);
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const cols = showMoney
    ? (["market", "picked", "paid", "refunded", "net"] as const)
    : (["market", "picked", "paid", "rate"] as const);
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="bfee-h">
      <h2 id="bfee-h" className="mb-1 font-semibold">
        {t(showMoney ? "titleFinance" : "titleFunnel")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("note")}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <div tabIndex={0} role="region" aria-label={t("titleFunnel")} className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <caption className="sr-only">{t(showMoney ? "titleFinance" : "titleFunnel")}</caption>
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                {cols.map((k) => (
                  <th key={k} scope="col" className="py-2 pr-3 font-medium">
                    {t(`cols.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.market_id}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {markets.find((m) => m.id === r.market_id)?.name ?? "–"}
                  </th>
                  <td className="py-2 pr-3 tabular-nums">{r.picked}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.paid}</td>
                  {showMoney ? (
                    <>
                      <td className="py-2 pr-3 tabular-nums">{r.refunded}</td>
                      <td className="py-2 pr-3 font-semibold tabular-nums">
                        {money(r.charged_cents - r.refunded_cents)}
                      </td>
                    </>
                  ) : (
                    <td className="py-2 pr-3 tabular-nums">
                      {r.picked ? `${Math.round((r.paid / r.picked) * 100)}%` : "–"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
