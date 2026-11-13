import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { ApplyForm } from "@/components/site/apply-form";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { PageHero } from "@/components/site/page-hero";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import { cityLabel } from "@/lib/market";
import { getMarkets, getServices } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("forProviders.form");
  return pageMetadata({
    title: t("title"),
    description: t("intro"),
    path: "/for-providers/apply",
  });
}

export default async function ApplyPage() {
  const messages = await getMessages();
  const [t, ts, markets, services] = await Promise.all([
    getTranslations("forProviders"),
    getTranslations("site"),
    getMarkets(),
    getServices(),
  ]);
  return (
    <SitePage>
      <Breadcrumbs
        items={[
          { href: "/for-providers", label: ts("nav.forProviders") },
          { href: "/for-providers/apply", label: t("form.title") },
        ]}
      />
      <PageHero title={t("form.title")} intro={t("form.intro")} />
      <div className="mx-auto max-w-3xl px-4">
        {/* Only this form needs translations in the browser; the rest of the site ships none. */}
        <NextIntlClientProvider
          messages={{
            forProviders: {
              form: (messages as Record<string, Record<string, unknown>>).forProviders!.form,
            },
          }}
        >
          <ApplyForm
            markets={markets.map((m) => ({ value: m.slug, label: cityLabel(m) }))}
            services={services.map((s) => ({ value: s.slug, label: serviceName(ts, s) }))}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
          />
        </NextIntlClientProvider>
      </div>
    </SitePage>
  );
}
