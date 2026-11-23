import { formatCurrency, type Locale } from "@rsos/i18n";
import { EmptyState } from "@rsos/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import { ServicesEditor } from "@/components/services/services-editor";
import { PageHead, pageMain } from "@/components/shell/page-head";
import { getMarketPricing, getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  const [pricing, { data }] = await Promise.all([
    getMarketPricing(ctx.marketSlug),
    getPortalData(ctx, Date.now()),
  ]);
  return { ctx, pricing, provider: data.provider };
}

/**
 * Services, prices and service area (RSOS-058). Ranges and fees are the market's real ones; the
 * company's own prices, area, hours and budget are kept on this device until saving is wired.
 */
export default async function ServicesPage() {
  const [t, ts, locale, { pricing, provider }] = await Promise.all([
    getTranslations("portal.services"),
    getTranslations("site.services"),
    getLocale(),
    load(),
  ]);
  const services = pricing
    .filter((p) => p.enabled && p.price_min_cents !== null && p.price_max_cents !== null)
    .map((p) => ({
      slug: p.service_slug,
      name: ts.has(`${p.service_slug}.name`) ? ts(`${p.service_slug}.name`) : p.service_name,
      min: p.price_min_cents!,
      max: p.price_max_cents!,
      fee: p.platform_fee_cents ?? 0,
    }));
  const money = (c: number) => formatCurrency(c, locale as Locale);
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      {services.length === 0 ? (
        <EmptyState title={t("none")} />
      ) : (
        <ServicesEditor
          services={services.map((s) => ({
            ...s,
            rangeLabel: t("range", { min: money(s.min), max: money(s.max) }),
          }))}
          home={provider.home}
          labels={{
            prices: t("prices"),
            offer: t("offer"),
            preview: t("preview"),
            fee: t("fee"),
            outside: t("outside"),
            area: t("area"),
            radius: t("radius"),
            miles: t("miles"),
            map: t("map"),
            hours: t("hours"),
            always: t("always"),
            from: t("from"),
            to: t("to"),
            budget: t("budget"),
            budgetHint: t("budgetHint"),
            save: t("save"),
            saved: t("saved"),
            fix: t("fix"),
            home: t("home"),
          }}
          formats={{ currency: locale === "es" ? "es-US" : "en-US" }}
        />
      )}
    </main>
  );
}
