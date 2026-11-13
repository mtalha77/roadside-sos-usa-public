import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ContactForm } from "@/components/site/contact-form";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";
import { TOPICS } from "@/lib/contact-topics";
import { cityLabel } from "@/lib/market";
import { getMarkets } from "@/lib/site-data";
import { getVisitorMarket } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.contact");
  return { title: t("title"), description: t("intro"), alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const [t, markets, detection] = await Promise.all([
    getTranslations("pages.contact"),
    getMarkets(),
    getVisitorMarket(),
  ]);
  return (
    <SitePage>
      <PageHero title={t("title")} intro={t("intro")} />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4">
        <Alert tone="info" title={t("urgent")}>
          <Button asChild size="sm" className="mt-2">
            <Link href="/get-help">{t("getHelp")}</Link>
          </Button>
        </Alert>
        <ContactForm
          topics={TOPICS}
          markets={markets.map((m) => ({ slug: m.slug, label: cityLabel(m) }))}
          currentMarket={detection.kind === "market" ? detection.market.slug : null}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
        />
      </div>
    </SitePage>
  );
}
