import { brand } from "@rsos/config/brand";
import { getSiteUrl } from "@rsos/config/site";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { FaqList } from "@/components/site/faq-list";
import { JsonLd } from "@/components/site/json-ld";
import { HowItWorks } from "@/components/site/how-it-works";
import { EmergencyHero, Reassurance } from "@/components/site/emergency-hero";
import { MarketPicker } from "@/components/site/market-picker";
import { OutsideArea } from "@/components/site/outside-area";
import { PriceList } from "@/components/site/price-list";
import { ProviderBand } from "@/components/site/provider-band";
import { SitePage } from "@/components/site/site-page";
import { cityLabel, marketPath } from "@/lib/market";
import { orderTiles } from "@/lib/tiles";
import {
  getBookingSpeed,
  getMarkets,
  getMarketServices,
  getMarketStats,
  getServices,
} from "@/lib/site-data";
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

/**
 * Home, emergency first (RSOS-100): the hero with the six service tiles is the main action; then
 * reassurance, how it works, local prices, cities, FAQ and the provider call to action.
 */
export default async function HomePage() {
  const [t, markets, services, detection] = await Promise.all([
    getTranslations("home"),
    getMarkets(),
    getServices(),
    getVisitorMarket(),
  ]);
  const market = detection.kind === "market" ? detection.market : null;
  const [marketServices, stats, bookMinutes] = market
    ? await Promise.all([
        getMarketServices(market.slug),
        getMarketStats(market.slug),
        getBookingSpeed(market.slug),
      ])
    : [[], null, null];
  const offered = services.filter((s) => s.market_count > 0);
  const tiles = orderTiles(
    market
      ? marketServices
          .filter((s) => s.enabled)
          .map((s) => ({ slug: s.service_slug, name: s.service_name, icon_key: s.icon_key }))
      : offered,
  );
  return (
    <SitePage>
      <EmergencyHero
        headline={t("hero.headline")}
        services={tiles}
        marketSlug={market?.slug ?? null}
        city={market?.name ?? null}
        providerCount={stats?.provider_count ?? null}
        bookMinutes={bookMinutes}
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4">
        <Reassurance />
        {detection.kind === "outside" ? (
          <OutsideArea city={detection.city} region={detection.region} markets={markets} />
        ) : null}
        <HowItWorks
          examplePriceCents={
            marketServices.find((s) => s.enabled && s.price_min_cents !== null)?.price_min_cents ??
            offered[0]?.price_min_cents ??
            null
          }
        />
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
        <section aria-labelledby="cities-title" className="flex scroll-mt-20 flex-col gap-3">
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
