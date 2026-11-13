import { Button } from "@rsos/ui/button";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { PageHero } from "@/components/site/page-hero";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import { cityLabel, marketPath } from "@/lib/market";
import { getMarketByPath, getMarketServices } from "@/lib/site-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ state: string; city: string; service: string }> };

async function load(p: Params["params"]) {
  const { state, city, service } = await p;
  const market = await getMarketByPath(state, city);
  if (!market) return null;
  const svc = (await getMarketServices(market.slug)).find((s) => s.service_slug === service);
  return svc ? { market, svc } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const t = await getTranslations("site");
  return {
    title: t("cityService.title", {
      service: serviceName(t, { slug: data.svc.service_slug, name: data.svc.service_name }),
      city: data.market.name,
    }),
  };
}

/** City plus service page: one per service per published market. */
export default async function CityServicePage({ params }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const { market, svc } = data;
  const t = await getTranslations("site");
  const name = serviceName(t, { slug: svc.service_slug, name: svc.service_name });
  return (
    <SitePage marketSlug={market.slug}>
      <Breadcrumbs
        items={[
          { href: marketPath(market), label: cityLabel(market) },
          { href: `${marketPath(market)}/${svc.service_slug}`, label: name },
        ]}
      />
      <PageHero title={t("cityService.title", { service: name, city: market.name })}>
        <Button asChild className="self-start">
          <Link href={`/get-help?service=${svc.service_slug}&market=${market.slug}`}>
            {t("nav.getHelp")}
          </Link>
        </Button>
      </PageHero>
    </SitePage>
  );
}
