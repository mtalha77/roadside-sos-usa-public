import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
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
  return pageMetadata({ title: t("title"), description: t("intro"), path: "/contact" });
}

export default async function ContactPage() {
  const messages = await getMessages();
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
        {/* Only this form needs translations in the browser; the rest of the site ships none. */}
        <NextIntlClientProvider
          messages={{
            pages: {
              contact: (messages as Record<string, Record<string, unknown>>).pages!.contact,
            },
          }}
        >
          <ContactForm
            topics={TOPICS}
            markets={markets.map((m) => ({ slug: m.slug, label: cityLabel(m) }))}
            currentMarket={detection.kind === "market" ? detection.market.slug : null}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
          />
        </NextIntlClientProvider>
      </div>
    </SitePage>
  );
}
