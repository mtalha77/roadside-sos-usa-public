import { averageFee, breakEvenJobs, discountedFee } from "@rsos/core/plans";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Button } from "@rsos/ui/button";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import { cityLabel } from "@/lib/market";
import { getMarkets, getMarketServices, getPlanCatalog } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("forProviders");
  return pageMetadata({
    title: t("title"),
    description: t("intro"),
    path: "/for-providers",
  });
}

/** For providers: how jobs arrive, the per-request fees (from `market_services`), plans, requirements. */
export default async function ForProvidersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, ts, markets, locale, sp] = await Promise.all([
    getTranslations("forProviders"),
    getTranslations("site"),
    getMarkets(),
    getLocale() as Promise<Locale>,
    searchParams,
  ]);
  const city = markets.find((m) => m.slug === sp.city) ?? markets[0] ?? null;
  const plans = await getPlanCatalog(city?.slug ?? null);
  const fees = await Promise.all(
    markets.map(async (m) => ({
      market: m,
      services: (await getMarketServices(m.slug)).filter((s) => s.enabled),
    })),
  );
  const lang = locale === "es" ? "es" : "en";
  const money = (c: number | null) => (c === null ? "—" : formatCurrency(c, locale));
  const plan = (k: "basic" | "pro" | "featured") => plans.find((p) => p.plan === k) ?? null;
  const basic = plan("basic");
  const pro = plan("pro");
  const featured = plan("featured");
  const cityFees = (fees.find((f) => f.market.slug === city?.slug)?.services ?? [])
    .map((x) => x.platform_fee_cents)
    .filter((c): c is number => c !== null);
  const avg = averageFee(cityFees);
  const breakEven =
    basic && pro && avg !== null
      ? breakEvenJobs(pro.price_cents ?? 0, basic.price_cents ?? 0, avg, pro.fee_discount_bps)
      : null;
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
        {basic ? (
          <section aria-labelledby="fp-plans" className="flex flex-col gap-4">
            <h2 id="fp-plans" className="text-3xl font-semibold">
              {t("plans.title")}
            </h2>
            <p className="max-w-3xl text-muted-foreground">{t("plans.lead")}</p>
            {markets.length > 1 ? (
              <nav aria-label={t("plans.cities")} className="flex flex-wrap gap-2">
                {markets.map((m) => (
                  <Link
                    key={m.slug}
                    href={`/for-providers?city=${m.slug}#fp-plans`}
                    aria-current={m.slug === city?.slug ? "true" : undefined}
                    className="inline-flex min-h-touch items-center rounded-full border px-4 text-sm font-medium aria-[current=true]:border-primary aria-[current=true]:bg-accent"
                  >
                    {cityLabel(m)}
                  </Link>
                ))}
              </nav>
            ) : null}
            <ul className="grid gap-4 md:grid-cols-3">
              {[basic, pro, featured]
                .filter((p) => p !== null)
                .map((p) => (
                  <li key={p.plan} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                    <h3 className="text-xl font-semibold">{p.name}</h3>
                    <p className="text-2xl font-semibold tabular-nums">
                      {p.plan === "featured"
                        ? t("plans.perMarket", { price: money(p.price_cents) })
                        : t("plans.perMonth", { price: money(p.price_cents) })}
                    </p>
                    <p className="text-sm text-muted-foreground">{t(`plans.who.${p.plan}`)}</p>
                    <p className="text-sm font-medium">
                      {p.plan === "featured"
                        ? t("plans.feesSame")
                        : p.fee_discount_bps
                          ? t("plans.feesOff", { pct: p.fee_discount_bps / 100 })
                          : t("plans.feesFull")}
                    </p>
                    <ul className="flex flex-col gap-2 text-sm">
                      {p.bullets[lang].map((b) => (
                        <li key={b} className="flex gap-2">
                          <Check
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-success-strong"
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
            {breakEven !== null && pro ? (
              <p className="font-medium">
                {t("plans.breakEven", {
                  jobs: breakEven,
                  gap: money((pro.price_cents ?? 0) - (basic.price_cents ?? 0)),
                })}
              </p>
            ) : null}
            {pro && cityFees.length ? (
              <p className="text-sm text-muted-foreground">
                {t("plans.proFees", {
                  example: money(discountedFee(Math.max(...cityFees), pro.fee_discount_bps)),
                  full: money(Math.max(...cityFees)),
                })}
              </p>
            ) : null}
            <Button asChild size="lg" className="self-start">
              <Link href="/for-providers/apply">
                {basic.offer_cents !== null
                  ? t("plans.ctaOffer", { price: money(basic.offer_cents) })
                  : t("plans.cta", { price: money(basic.price_cents) })}
              </Link>
            </Button>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold">{t("plans.faqTitle")}</h3>
              {(["charged", "cancel", "featured", "anytime"] as const).map((k) => (
                <details key={k} className="rounded-xl border bg-card p-4">
                  <summary className="flex min-h-touch cursor-pointer items-center font-medium">
                    {t(`plans.faq.${k}.q`)}
                  </summary>
                  <p className="mt-2 text-muted-foreground">{t(`plans.faq.${k}.a`)}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
        <section aria-labelledby="fp-credit" className="flex flex-col gap-2">
          <h2 id="fp-credit" className="text-2xl font-semibold">
            {t("credit.title")}
          </h2>
          <p className="max-w-3xl text-muted-foreground">{t("credit.body")}</p>
        </section>
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
