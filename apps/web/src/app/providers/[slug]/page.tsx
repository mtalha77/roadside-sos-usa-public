import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const t = await getTranslations("site.placeholder");
  return pageMetadata({
    title: t("providerTitle"),
    path: `/providers/${(await params).slug}`,
    noindex: true,
  });
}

/** Public provider profile (placeholder until provider profiles exist). */
export default async function ProviderProfilePage() {
  const t = await getTranslations("site.placeholder");
  return (
    <SitePage>
      <PageHero title={t("providerTitle")} intro={t("providerBody")} />
    </SitePage>
  );
}
