import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { PageHero } from "@/components/site/page-hero";
import { ServiceLinks } from "@/components/site/service-links";
import { SitePage } from "@/components/site/site-page";
import { cityLabel } from "@/lib/market";
import { getMarketByPath, getMarketServices } from "@/lib/site-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ state: string; city: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { state, city } = await params;
  const market = await getMarketByPath(state, city);
  const t = await getTranslations("site.city");
  return market ? { title: t("title", { city: market.name, state: market.state_code }) } : {};
}

/** City page: one per published market, generated from the database. */
export default async function CityPage({ params }: Params) {
  const { state, city } = await params;
  const market = await getMarketByPath(state, city);
  if (!market) notFound();
  const [t, services] = await Promise.all([
    getTranslations("site.city"),
    getMarketServices(market.slug),
  ]);
  return (
    <SitePage marketSlug={market.slug}>
      <Breadcrumbs
        items={[
          {
            href: `/roadside-assistance/${state}/${city}`,
            label: cityLabel(market),
          },
        ]}
      />
      <PageHero title={t("title", { city: market.name, state: market.state_code })} />
      <section className="mx-auto max-w-6xl px-4">
        <ServiceLinks
          services={services
            .filter((s) => s.enabled)
            .map((s) => ({ slug: s.service_slug, name: s.service_name, icon_key: s.icon_key }))}
          hrefFor={(slug) => `/roadside-assistance/${state}/${city}/${slug}`}
        />
      </section>
    </SitePage>
  );
}
