import { brand } from "@rsos/config/brand";
import { getSiteUrl } from "@rsos/config/site";
import { formatPriceRange, type Locale } from "@rsos/i18n";
import { Button } from "@rsos/ui/button";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { serviceName } from "@/components/site/service-label";
import { ServiceDetails } from "@/components/site/service-details";
import { SitePage } from "@/components/site/site-page";
import { cityLabel, marketPath } from "@/lib/market";
import { getMarkets, getServicePage, getServices } from "@/lib/site-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ service: string }> };

async function load(params: Params["params"]) {
  const { service } = await params;
  const svc = (await getServices()).find((s) => s.slug === service);
  if (!svc) return null;
  const locale = await getLocale();
  const [page, markets] = await Promise.all([getServicePage(svc.slug, locale), getMarkets()]);
  return { svc, page, markets, locale: locale as Locale };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const t = await getTranslations("site");
  const name = serviceName(t, data.svc);
  return {
    title: name,
    description: t("service.description", { service: name }),
    alternates: { canonical: `/services/${data.svc.slug}` },
  };
}

/** Service page: one per service in the database, with links to every city that offers it. */
export default async function ServicePageRoute({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { svc, page, markets, locale } = data;
  const t = await getTranslations("site");
  const name = serviceName(t, svc);
  const offered = svc.market_count > 0;
  const base = getSiteUrl();
  return (
    <SitePage>
      <Breadcrumbs items={[{ href: `/services/${svc.slug}`, label: name }]} />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-6 pb-8 sm:pt-10">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{name}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          {page?.summary ?? serviceName(t, svc, "short")}
        </p>
        {offered && svc.price_min_cents !== null && svc.price_max_cents !== null ? (
          <p>
            <span className="font-semibold">{t("service.typicalPrice")}</span>{" "}
            <span className="tabular-nums">
              {t("service.typicalPriceRange", {
                range: formatPriceRange(svc.price_min_cents, svc.price_max_cents, locale),
              })}
            </span>
            <br />
            <span className="text-sm text-muted-foreground">{t("service.priceNote")}</span>
          </p>
        ) : null}
        {offered ? (
          <Button asChild size="lg" className="self-start">
            <Link href={`/get-help?service=${svc.slug}`}>{t("nav.getHelp")}</Link>
          </Button>
        ) : null}
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4">
        <nav aria-labelledby="svc-cities">
          <h2 id="svc-cities" className="mb-3 text-2xl font-semibold">
            {t("service.inCities", { service: name })}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {markets.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`${marketPath(m)}/${svc.slug}`}
                  className="flex min-h-touch items-center rounded-xl border bg-card px-4 py-3 font-medium hover:border-input hover:shadow-sm"
                >
                  {t("city.serviceIn", { service: name, city: cityLabel(m) })}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {page ? <ServiceDetails page={page} serviceLabel={name} /> : null}
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name,
          serviceType: name,
          description: page?.summary,
          url: `${base}/services/${svc.slug}`,
          provider: { "@type": "Organization", name: brand.name, url: base },
          areaServed: markets.map((m) => ({ "@type": "City", name: cityLabel(m) })),
          ...(offered && svc.price_min_cents !== null && svc.price_max_cents !== null
            ? {
                offers: {
                  "@type": "Offer",
                  priceSpecification: {
                    "@type": "PriceSpecification",
                    priceCurrency: "USD",
                    minPrice: svc.price_min_cents / 100,
                    maxPrice: svc.price_max_cents / 100,
                  },
                },
              }
            : {}),
        }}
      />
    </SitePage>
  );
}
