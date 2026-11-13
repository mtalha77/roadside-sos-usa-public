import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const t = await getTranslations("site.placeholder");
  return pageMetadata({
    title: t("trackTitle"),
    path: `/r/${(await params).token}`,
    noindex: true,
  });
}

/** Request tracking link (placeholder until the tracking ticket). */
export default async function TrackPage() {
  const t = await getTranslations("site.placeholder");
  return (
    <SitePage>
      <PageHero title={t("trackTitle")} intro={t("trackBody")} />
    </SitePage>
  );
}
