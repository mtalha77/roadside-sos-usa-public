import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarketPicker } from "@/components/site/market-picker";
import { OutsideArea } from "@/components/site/outside-area";
import { PageHero } from "@/components/site/page-hero";
import { serviceName } from "@/components/site/service-label";
import { ServiceLinks } from "@/components/site/service-links";
import { SitePage } from "@/components/site/site-page";
import { cityLabel } from "@/lib/market";
import { getMarkets, getServices } from "@/lib/site-data";
import { getVisitorMarket } from "@/lib/visitor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Start of the request flow (placeholder until the request flow tickets): keeps market and service. */
export default async function GetHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; market?: string }>;
}) {
  const sp = await searchParams;
  const [t, markets, services] = await Promise.all([
    getTranslations("site"),
    getMarkets(),
    getServices(),
  ]);
  const detection = await getVisitorMarket(sp.market);
  const market = detection.kind === "market" ? detection.market : null;
  const service = services.find((s) => s.slug === sp.service && s.market_count > 0) ?? null;
  return (
    <SitePage marketSlug={market?.slug}>
      <PageHero title={t("placeholder.getHelpTitle")} intro={t("placeholder.getHelpBody")}>
        <dl className="flex flex-wrap gap-x-6 gap-y-1" data-testid="get-help-selection">
          {service ? (
            <div data-service={service.slug}>
              <dt className="sr-only">{t("nav.services")}</dt>
              <dd className="font-semibold">
                {t("placeholder.getHelpService", { service: serviceName(t, service) })}
              </dd>
            </div>
          ) : null}
          {market ? (
            <div data-market={market.slug}>
              <dt className="sr-only">{t("market.label")}</dt>
              <dd className="font-semibold">
                {t("placeholder.getHelpMarket", { city: cityLabel(market) })}
              </dd>
            </div>
          ) : null}
        </dl>
      </PageHero>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
        {detection.kind === "outside" ? (
          <OutsideArea city={detection.city} region={detection.region} markets={markets} />
        ) : (
          <MarketPicker markets={markets} current={market} />
        )}
        {service ? null : (
          <ServiceLinks
            services={services.filter((s) => s.market_count > 0)}
            marketSlug={market?.slug}
          />
        )}
      </div>
    </SitePage>
  );
}
