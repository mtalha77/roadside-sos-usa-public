import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Public provider profile (placeholder until provider profiles exist). */
export default async function ProviderProfilePage() {
  const t = await getTranslations("site.placeholder");
  return (
    <SitePage>
      <PageHero title={t("providerTitle")} intro={t("providerBody")} />
    </SitePage>
  );
}
