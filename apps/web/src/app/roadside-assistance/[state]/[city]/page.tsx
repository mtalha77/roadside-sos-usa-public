import { brand } from "@rsos/config/brand";
import { getSiteUrl } from "@rsos/config/site";
import { Button } from "@rsos/ui/button";
import { Phone } from "lucide-react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { FaqList } from "@/components/site/faq-list";
import { JsonLd } from "@/components/site/json-ld";
import { LiveProof } from "@/components/site/live-proof";
import { PriceList } from "@/components/site/price-list";
import { serviceName } from "@/components/site/service-label";
import { ServiceLinks } from "@/components/site/service-links";
import { SitePage } from "@/components/site/site-page";
import { cityLabel, formatPhone, marketPath, nearestMarkets } from "@/lib/market";
import {
  getMarketByPath,
  getMarketPage,
  getMarkets,
  getMarketServices,
  getMarketStats,
} from "@/lib/site-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ state: string; city: string }> };

async function load(params: Params["params"]) {
  const { state, city } = await params;
  const market = await getMarketByPath(state, city);
  if (!market) return null;
  const locale = await getLocale();
  const [page, services, stats, markets] = await Promise.all([
    getMarketPage(market.slug, locale),
    getMarketServices(market.slug),
    getMarketStats(market.slug),
    getMarkets(),
  ]);
  return { market, page, services, stats, markets };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const t = await getTranslations("site.city");
  const vars = { city: data.market.name, state: data.market.state_code };
  const path = marketPath(data.market);
  return pageMetadata({ title: t("title", vars), description: t("description", vars), path });
}

/** City page: one per published market, copy and prices from the database. */
export default async function CityPage({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { market, page, services, stats, markets } = data;
  const t = await getTranslations("site");
  const vars = { city: market.name, state: market.state_code };
  const path = marketPath(market);
  const enabled = services.filter((s) => s.enabled);
  const base = getSiteUrl();
  const nearby = nearestMarkets(market, markets);
  return (
    <SitePage marketSlug={market.slug}>
      <Breadcrumbs items={[{ href: path, label: cityLabel(market) }]} />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-6 pb-8 sm:pt-10">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {page?.headline ?? t("city.title", vars)}
        </h1>
        {page ? <p className="max-w-3xl text-lg text-muted-foreground">{page.intro}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/get-help?market=${market.slug}`}>{t("nav.getHelp")}</Link>
          </Button>
          {market.phone ? (
            <Button asChild size="lg" variant="outline">
              <a href={`tel:${market.phone}`}>
                <Phone aria-hidden="true" className="size-5" />
                <span className="tabular-nums">
                  {t("city.call", { phone: formatPhone(market.phone) })}
                </span>
              </a>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4">
        <section aria-labelledby="city-services" className="flex flex-col gap-4">
          <h2 id="city-services" className="text-2xl font-semibold">
            {t("city.servicesTitle", vars)}
          </h2>
          <ServiceLinks
            services={enabled.map((s) => ({
              slug: s.service_slug,
              name: s.service_name,
              icon_key: s.icon_key,
            }))}
            marketSlug={market.slug}
          />
        </section>
        <LiveProof stats={stats} city={market.name} />
        <PriceList services={services} city={market.name} hrefFor={(s) => `${path}/${s}`} />
        {page ? (
          <div className="grid gap-10 md:grid-cols-2">
            <section aria-labelledby="city-areas">
              <h2 id="city-areas" className="mb-3 text-2xl font-semibold">
                {t("city.areasTitle")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {page.areas.map((a) => (
                  <li key={a} className="rounded-full bg-muted px-3 py-1">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="city-roads">
              <h2 id="city-roads" className="mb-3 text-2xl font-semibold">
                {t("city.highwaysTitle")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {page.highways.map((h) => (
                  <li key={h} className="rounded-full bg-muted px-3 py-1 tabular-nums">
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
        {page?.local_tips.length ? (
          <section aria-labelledby="city-tips">
            <h2 id="city-tips" className="mb-3 text-2xl font-semibold">
              {t("city.tipsTitle", vars)}
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-6">
              {page.local_tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {page?.faqs.length ? (
          <section aria-labelledby="city-faq" className="flex flex-col gap-4">
            <h2 id="city-faq" className="text-2xl font-semibold">
              {t("city.faqTitle", vars)}
            </h2>
            <FaqList items={page.faqs.map((f, i) => ({ id: `faq-${i + 1}`, q: f.q, a: f.a }))} />
          </section>
        ) : null}
        {nearby.length ? (
          <nav aria-labelledby="city-nearby">
            <h2 id="city-nearby" className="mb-3 text-2xl font-semibold">
              {t("city.nearbyTitle")}
            </h2>
            <ul className="flex flex-wrap gap-x-6">
              {nearby.map((m) => (
                <li key={m.slug}>
                  <Link
                    className="inline-flex min-h-touch items-center underline underline-offset-4"
                    href={marketPath(m)}
                  >
                    {cityLabel(m)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: t("city.title", vars),
          name: t("city.title", vars),
          url: base + path,
          provider: { "@type": "Organization", name: brand.name, url: base },
          areaServed: {
            "@type": "City",
            name: market.name,
            containedInPlace: { "@type": "State", name: market.state_code },
          },
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: t("city.servicesTitle", vars),
            itemListElement: enabled
              .filter((s) => s.price_min_cents !== null && s.price_max_cents !== null)
              .map((s) => ({
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: serviceName(t, { slug: s.service_slug, name: s.service_name }),
                },
                priceSpecification: {
                  "@type": "PriceSpecification",
                  priceCurrency: "USD",
                  minPrice: s.price_min_cents! / 100,
                  maxPrice: s.price_max_cents! / 100,
                },
              })),
          },
        }}
      />
    </SitePage>
  );
}
