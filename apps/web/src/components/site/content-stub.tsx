import { getTranslations } from "next-intl/server";
import { PageHero } from "./page-hero";
import { SitePage } from "./site-page";

/** Placeholder frame for content pages whose copy arrives in later tickets. */
export async function ContentStub({ titleKey }: { titleKey: string }) {
  const [t, common] = await Promise.all([getTranslations("site"), getTranslations("common")]);
  return (
    <SitePage>
      <PageHero title={t(titleKey)} intro={common("comingSoon")} />
    </SitePage>
  );
}
