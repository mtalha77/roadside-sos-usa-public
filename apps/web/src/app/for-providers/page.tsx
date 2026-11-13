import { formatCurrency, formatPriceRange, type Locale } from "@rsos/i18n";
import { Button } from "@rsos/ui/button";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import { cityLabel } from "@/lib/market";
import { getMarketPlans, getMarkets, getMarketServices } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("forProviders");
  return {
    title: t("title"),
    description: t("intro"),
    alternates: { canonical: "/for-providers" },
  };
}

/** For providers: how jobs arrive, the per-request fees (from `market_services`), plans, requirements. */
export default async function ForProvidersPage() {
  const [t, ts, markets, plans, locale] = await Promise.all([
    getTranslations("forProviders"),
    getTranslations("site"),
    getMarkets(),
    getMarketPlans(),
    getLocale() as Promise<Locale>,
  ]);
  const fees = await Promise.all(
    markets.map(async (m) => ({
      market: m,
      services: (await getMarketServices(m.slug)).filter((s) => s.enabled),
    })),
  );
  const range = (plan: "pro" | "featured") => {
    const rows = plans.filter((p) => p.plan === plan);
    if (!rows.length) return null;
    const min = Math.min(...rows.map((r) => r.price_min_cents));
    const max = Math.max(...rows.map((r) => r.price_max_cents));
    return {
      text: formatPriceRange(min, max, locale),
      discount: Math.max(...rows.map((r) => r.fee_discount_bps)),
    };
  };
  const pro = range("pro");
  const featured = range("featured");
  const steps = t.raw("how.steps") as [string, string][];
  return (
    <SitePage>
      <PageHero title={t("title")} intro={t("intro")}>
        <Button asChild size="lg" className="self-start">
          <Link href="/for-providers/apply">{t("apply")}</Link>
        </Button>
      </PageHero>
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4">
        <section aria-labelledby="fp-how">
          <h2 id="fp-how" className="mb-4 text-3xl font-semibold">
            {t("how.title")}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map(([title, body], i) => (
              <li key={title} className="rounded-2xl border bg-card p-5">
                <span
                  aria-hidden="true"
                  className="mb-3 grid size-10 place-items-center rounded-full bg-primary font-semibold text-primary-foreground tabular-nums"
                >
                  {i + 1}
                </span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="fp-money">
          <h2 id="fp-money" className="mb-4 text-3xl font-semibold">
            {t("money.title")}
          </h2>
          <ul className="flex flex-col gap-2">
            {(["yourPrices", "direct", "fee", "noMonthly"] as const).map((k) => (
              <li key={k} className="flex gap-2">
                <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-success-strong" />
                {t(`money.${k}`)}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="fp-fees" className="flex flex-col gap-4">
          <h2 id="fp-fees" className="text-3xl font-semibold">
            {t("fees.title")}
          </h2>
          <p className="text-muted-foreground">{t("fees.intro")}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {fees.map(({ market, services }) => (
              <div key={market.slug} className="rounded-2xl border bg-card p-4">
                <h3 className="mb-2 text-lg font-semibold">{cityLabel(market)}</h3>
                {services.some((s) => s.platform_fee_cents !== null) ? (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-sm text-muted-foreground">
                        <th className="py-1 font-medium">{t("fees.service")}</th>
                        <th className="py-1 text-right font-medium">{t("fees.fee")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services
                        .filter((s) => s.platform_fee_cents !== null)
                        .map((s) => (
                          <tr key={s.service_slug} className="border-t">
                            <td className="py-2">
                              {serviceName(ts, { slug: s.service_slug, name: s.service_name })}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {formatCurrency(s.platform_fee_cents!, locale)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-muted-foreground">{t("fees.none")}</p>
                )}
              </div>
            ))}
          </div>
        </section>
        {pro || featured ? (
          <section aria-labelledby="fp-plans" className="flex flex-col gap-4">
            <h2 id="fp-plans" className="text-3xl font-semibold">
              {t("plans.title")}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pro ? (
                <div className="rounded-2xl border bg-card p-5">
                  <h3 className="text-xl font-semibold">{t("plans.pro")}</h3>
                  <p className="text-lg font-semibold tabular-nums">
                    {t("plans.price", { range: pro.text })}
                  </p>
                  <p className="text-muted-foreground">
                    {t("plans.proBody", { discount: `${pro.discount / 100}%` })}
                  </p>
                </div>
              ) : null}
              {featured ? (
                <div className="rounded-2xl border bg-card p-5">
                  <h3 className="text-xl font-semibold">{t("plans.featured")}</h3>
                  <p className="text-lg font-semibold tabular-nums">
                    {t("plans.price", { range: featured.text })}
                  </p>
                  <p className="text-muted-foreground">{t("plans.featuredBody")}</p>
                </div>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">{t("plans.note")}</p>
          </section>
        ) : null}
        <section aria-labelledby="fp-req">
          <h2 id="fp-req" className="mb-4 text-3xl font-semibold">
            {t("requirements.title")}
          </h2>
          <ul className="flex flex-col gap-2">
            {(["insurance", "license", "vehicle", "phone"] as const).map((k) => (
              <li key={k} className="flex gap-2">
                <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-success-strong" />
                {t(`requirements.${k}`)}
              </li>
            ))}
          </ul>
        </section>
        <Button asChild size="lg" className="self-start">
          <Link href="/for-providers/apply">{t("apply")}</Link>
        </Button>
      </div>
    </SitePage>
  );
}
