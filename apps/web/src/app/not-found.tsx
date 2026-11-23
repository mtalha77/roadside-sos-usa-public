import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";

export default async function NotFound() {
  const t = await getTranslations("site.notFound");
  return (
    <SitePage>
      <PageHero title={t("title")} intro={t("body")}>
        <Button asChild className="self-start">
          <Link href="/">{t("home")}</Link>
        </Button>
      </PageHero>
    </SitePage>
  );
}
