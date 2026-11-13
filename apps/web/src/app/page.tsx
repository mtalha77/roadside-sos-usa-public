import { getTranslations } from "next-intl/server";
import { OutsideArea } from "@/components/site/outside-area";
import { MarketPicker } from "@/components/site/market-picker";
import { PageHero } from "@/components/site/page-hero";
import { ServiceLinks } from "@/components/site/service-links";
import { SitePage } from "@/components/site/site-page";
import { getMarkets, getServices } from "@/lib/site-data";
import { getVisitorMarket } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [t, markets, services, detection] = await Promise.all([
    getTranslations("web"),
    getMarkets(),
    getServices(),
    getVisitorMarket(),
  ]);
  const market = detection.kind === "market" ? detection.market : null;
  const offered = services.filter((s) => s.market_count > 0);
  return (
    <SitePage>
      <PageHero title={t("headline")} intro={t("body")} />
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
        <ServiceLinks services={offered} marketSlug={market?.slug} />
        {detection.kind === "outside" ? (
          <OutsideArea city={detection.city} region={detection.region} markets={markets} />
        ) : (
          <MarketPicker markets={markets} current={market} />
        )}
      </section>
    </SitePage>
  );
}
