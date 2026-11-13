import { brand } from "@rsos/config/brand";
import { getSiteUrl } from "@rsos/config/site";
import { formatPriceRange, type Locale } from "@rsos/i18n";
import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Phone } from "lucide-react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { serviceName } from "@/components/site/service-label";
import { ServiceDetails } from "@/components/site/service-details";
import { SitePage } from "@/components/site/site-page";
import { cityLabel, formatPhone, marketPath } from "@/lib/market";
import {
  getMarketByPath,
  getMarketServiceNote,
  getMarketServices,
  getServicePage,
} from "@/lib/site-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ state: string; city: string; service: string }> };

async function load(params: Params["params"]) {
  const { state, city, service } = await params;
  const market = await getMarketByPath(state, city);
  if (!market) return null;
  const services = await getMarketServices(market.slug);
  const svc = services.find((s) => s.service_slug === service);
  if (!svc) return null;
  const locale = await getLocale();
  const [page, note] = await Promise.all([
    getServicePage(svc.service_slug, locale),
    getMarketServiceNote(market.slug, svc.service_slug, locale),
  ]);
  return { market, svc, services, page, note, locale: locale as Locale };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const t = await getTranslations("site");
  const name = serviceName(t, { slug: data.svc.service_slug, name: data.svc.service_name });
  const vars = { service: name, city: data.market.name, state: data.market.state_code };
  return pageMetadata({
    title: `${t("cityService.title", vars)}, ${data.market.state_code}`,
    description: t("service.cityDescription", vars),
    path: `${marketPath(data.market)}/${data.svc.service_slug}`,
  });
}

/** City plus service page: local price, local note, and the flow started with both preselected. */
export default async function CityServicePage({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { market, svc, services, page, note, locale } = data;
  const [t, tp] = await Promise.all([getTranslations("site"), getTranslations("home.prices")]);
  const name = serviceName(t, { slug: svc.service_slug, name: svc.service_name });
  const city = cityLabel(market);
  const path = `${marketPath(market)}/${svc.service_slug}`;
  const hasPrice = svc.enabled && svc.price_min_cents !== null && svc.price_max_cents !== null;
  const fallback = services.find((s) => s.service_slug === "tow" && s.enabled);
  const start = svc.enabled ? svc.service_slug : fallback?.service_slug;
  const base = getSiteUrl();
  return (
    <SitePage marketSlug={market.slug}>
      <Breadcrumbs
        items={[
          { href: marketPath(market), label: city },
          { href: path, label: name },
        ]}
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-6 pb-8 sm:pt-10">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t("cityService.title", { service: name, city })}
        </h1>
        {note ? <p className="max-w-3xl text-lg">{note}</p> : null}
        {page ? <p className="max-w-3xl text-muted-foreground">{page.summary}</p> : null}
        {!svc.enabled ? (
          <Alert tone="info" title={t("service.notOffered", { city: market.name })}>
            <p>{t("service.notOfferedBody")}</p>
          </Alert>
        ) : null}
        {hasPrice ? (
          <p>
            <span className="font-semibold">{t("service.localPrice", { city: market.name })}</span>{" "}
            <span className="font-semibold tabular-nums">
              {formatPriceRange(svc.price_min_cents!, svc.price_max_cents!, locale)}
            </span>
            {svc.price_note && tp.has(svc.price_note) ? (
              <span className="text-muted-foreground"> {tp(svc.price_note)}</span>
            ) : null}
            <br />
            <span className="text-sm text-muted-foreground">{t("service.priceNote")}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {start ? (
            <Button asChild size="lg">
              <Link
                href={`/get-help?service=${start}&market=${market.slug}`}
                data-flow-service={start}
                data-flow-market={market.slug}
              >
                {svc.enabled ? t("nav.getHelp") : t("service.requestTow")}
              </Link>
            </Button>
          ) : null}
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
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4">
        {page ? <ServiceDetails page={page} serviceLabel={name} /> : null}
        <nav aria-labelledby="cs-links" className="flex flex-col gap-3">
          <h2 id="cs-links" className="text-2xl font-semibold">
            {t("service.otherServices", { city: market.name })}
          </h2>
          <ul className="flex flex-wrap gap-x-6">
            {services
              .filter((s) => s.enabled && s.service_slug !== svc.service_slug)
              .map((s) => (
                <li key={s.service_slug}>
                  <Link
                    className="inline-flex min-h-touch items-center underline underline-offset-4"
                    href={`${marketPath(market)}/${s.service_slug}`}
                  >
                    {t("cityService.title", {
                      service: serviceName(t, { slug: s.service_slug, name: s.service_name }),
                      city: market.name,
                    })}
                  </Link>
                </li>
              ))}
            <li>
              <Link
                className="inline-flex min-h-touch items-center underline underline-offset-4"
                href={marketPath(market)}
              >
                {t("service.allCityServices", { city: market.name })}
              </Link>
            </li>
            <li>
              <Link
                className="inline-flex min-h-touch items-center underline underline-offset-4"
                href={`/services/${svc.service_slug}`}
              >
                {name}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: t("cityService.title", { service: name, city }),
          serviceType: name,
          url: base + path,
          provider: { "@type": "Organization", name: brand.name, url: base },
          areaServed: {
            "@type": "City",
            name: market.name,
            containedInPlace: { "@type": "State", name: market.state_code },
          },
          ...(hasPrice
            ? {
                offers: {
                  "@type": "Offer",
                  priceSpecification: {
                    "@type": "PriceSpecification",
                    priceCurrency: "USD",
                    minPrice: svc.price_min_cents! / 100,
                    maxPrice: svc.price_max_cents! / 100,
                  },
                },
              }
            : {}),
        }}
      />
    </SitePage>
  );
}
