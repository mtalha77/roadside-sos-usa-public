import { Button } from "@rsos/ui/button";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { PageHero } from "@/components/site/page-hero";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import { getServices } from "@/lib/site-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ service: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { service } = await params;
  const svc = (await getServices()).find((s) => s.slug === service);
  const t = await getTranslations("site");
  return svc ? { title: serviceName(t, svc) } : {};
}

/** Service page: one per service in the database. */
export default async function ServicePage({ params }: Params) {
  const { service } = await params;
  const svc = (await getServices()).find((s) => s.slug === service);
  if (!svc) notFound();
  const t = await getTranslations("site");
  const name = serviceName(t, svc);
  return (
    <SitePage>
      <Breadcrumbs items={[{ href: `/services/${svc.slug}`, label: name }]} />
      <PageHero title={name} intro={serviceName(t, svc, "short")}>
        {svc.market_count > 0 ? (
          <Button asChild className="self-start">
            <Link href={`/get-help?service=${svc.slug}`}>{t("nav.getHelp")}</Link>
          </Button>
        ) : null}
      </PageHero>
    </SitePage>
  );
}
