import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Request tracking link (placeholder until the tracking ticket). */
export default async function TrackPage() {
  const t = await getTranslations("site.placeholder");
  return (
    <SitePage>
      <PageHero title={t("trackTitle")} intro={t("trackBody")} />
    </SitePage>
  );
}
