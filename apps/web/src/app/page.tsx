import { brand } from "@rsos/config/brand";
import { getSiteUrl } from "@rsos/config/site";
import { Button } from "@rsos/ui/button";
import { BadgeCheck, Clock, Phone, WalletCards } from "lucide-react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { BudgetBreaker } from "@/components/site/budget-breaker";
import { FaqList } from "@/components/site/faq-list";
import { JsonLd } from "@/components/site/json-ld";
import { HowItWorks } from "@/components/site/how-it-works";
import { LiveProof } from "@/components/site/live-proof";
import { MarketPicker } from "@/components/site/market-picker";
import { OutsideArea } from "@/components/site/outside-area";
import { PriceList } from "@/components/site/price-list";
import { ProviderBand } from "@/components/site/provider-band";
import { ServiceLinks } from "@/components/site/service-links";
import { SitePage } from "@/components/site/site-page";
import { cityLabel, formatPhone, marketPath } from "@/lib/market";
import { getMarkets, getMarketServices, getMarketStats, getServices } from "@/lib/site-data";
import { getVisitorMarket } from "@/lib/visitor";

export const dynamic = "force-dynamic";

const FAQ_IDS = ["cost", "fast", "membership", "who", "safe"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return pageMetadata({
    title: `${t("title")} | ${brand.name}`,
    absolute: true,
    description: t("metaDescription"),
    path: "/",
  });
}

/** Home: services first (the main action), then how it works, local prices and proof, FAQ. */
export default async function HomePage() {
  const [t, markets, services, detection] = await Promise.all([
    getTranslations("home"),
    getMarkets(),
    getServices(),
    getVisitorMarket(),
  ]);
  const market = detection.kind === "market" ? detection.market : null;
  const [marketServices, stats] = market
    ? await Promise.all([getMarketServices(market.slug), getMarketStats(market.slug)])
    : [[], null];
  const offered = services.filter((s) => s.market_count > 0);
  // Example quote price: the low end of a real local range (the first offered service).
  const example = (marketServices.length ? marketServices : []).find(
    (s) => s.enabled && s.price_min_cents !== null,
  );
  const examplePrice = example?.price_min_cents ?? offered[0]?.price_min_cents ?? null;
  const trust = [
    { icon: BadgeCheck, label: t("trust.insured") },
    { icon: Clock, label: t("trust.fast") },
    { icon: WalletCards, label: t("trust.noMembership") },
  ];
  return (
    <SitePage>
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-8 pb-10 sm:pt-14">
        <p className="font-medium text-muted-foreground">{t("eyebrow")}</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          {t("headline")}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{t("lead")}</p>
        <h2 className="mt-2 text-xl font-semibold">{t("pickService")}</h2>
        <ServiceLinks services={offered} marketSlug={market?.slug} />
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={market ? `/get-help?market=${market.slug}` : "/get-help"}>
              {t("getHelp")}
            </Link>
          </Button>
          {market?.phone ? (
            <Button asChild size="lg" variant="outline">
              <a href={`tel:${market.phone}`}>
                <Phone aria-hidden="true" className="size-5" />
                <span className="tabular-nums">
                  {t("callNow", { phone: formatPhone(market.phone) })}
                </span>
              </a>
            </Button>
          ) : null}
        </div>
        <ul aria-label={t("trust.label")} className="flex flex-col gap-3 sm:flex-row sm:gap-8">
          {trust.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 font-medium">
              <Icon aria-hidden="true" className="size-5 text-success-strong" />
              {label}
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4">
        {detection.kind === "outside" ? (
          <OutsideArea city={detection.city} region={detection.region} markets={markets} />
        ) : null}
        {market ? <LiveProof stats={stats} city={market.name} /> : null}
        <HowItWorks examplePriceCents={examplePrice} />
        {market ? (
          <div className="flex flex-col gap-4">
            <PriceList
              services={marketServices}
              city={market.name}
              hrefFor={(s) => `${marketPath(market)}/${s}`}
            />
            <MarketPicker markets={markets} current={market} />
          </div>
        ) : detection.kind !== "outside" ? (
          <section className="flex flex-col gap-3">
            <p>{t("prices.choose")}</p>
            <MarketPicker markets={markets} current={null} />
          </section>
        ) : null}
        <section aria-labelledby="cities-title" className="flex flex-col gap-3">
          <h2 id="cities-title" className="text-3xl font-semibold">
            {t("cities.title")}
          </h2>
          <p className="text-muted-foreground">{t("cities.body")}</p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {markets.map((m) => (
              <li key={m.slug}>
                <Link
                  href={marketPath(m)}
                  className="flex min-h-touch items-center rounded-xl border bg-card px-4 py-3 font-medium hover:border-input hover:shadow-sm"
                >
                  {cityLabel(m)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="faq-title" className="flex flex-col gap-4">
          <h2 id="faq-title" className="text-3xl font-semibold">
            {t("faq.title")}
          </h2>
          <FaqList
            items={FAQ_IDS.map((id) => ({
              id: `faq-${id}`,
              q: t(`faq.items.${id}.q`),
              a: t(`faq.items.${id}.a`),
            }))}
          />
        </section>
        <ProviderBand />
        <BudgetBreaker />
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${getSiteUrl()}/#organization`,
              name: brand.name,
              url: getSiteUrl(),
              logo: `${getSiteUrl()}${brand.logos.icon}`,
              email: brand.emails.support,
              areaServed: markets.map((m) => ({ "@type": "City", name: cityLabel(m) })),
            },
            {
              "@type": "WebSite",
              "@id": `${getSiteUrl()}/#website`,
              name: brand.name,
              url: getSiteUrl(),
              publisher: { "@id": `${getSiteUrl()}/#organization` },
            },
          ],
        }}
      />
    </SitePage>
  );
}
