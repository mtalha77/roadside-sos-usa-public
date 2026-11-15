import { topUpPresets } from "@rsos/config/demo-fixtures";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { PageHead, pageMain } from "@/components/shell/page-head";
import { getMarketPricing, getPortalContext } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  return { ctx, pricing: await getMarketPricing(ctx.marketSlug) };
}

/**
 * Sign-up and onboarding wizard (RSOS-052): nine short steps, saved on this device after each one
 * so it can be resumed, then a "what happens next" screen and the in-review state.
 */
export default async function OnboardingPage() {
  const [t, ts, locale, { ctx, pricing }] = await Promise.all([
    getTranslations("portal.onboarding"),
    getTranslations("site.services"),
    getLocale(),
    load(),
  ]);
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const services = pricing
    .filter((p) => p.enabled && p.price_min_cents !== null && p.price_max_cents !== null)
    .map((p) => ({
      slug: p.service_slug,
      name: ts.has(`${p.service_slug}.name`) ? ts(`${p.service_slug}.name`) : p.service_name,
      min: p.price_min_cents! / 100,
      max: p.price_max_cents! / 100,
      range: t("range", { min: money(p.price_min_cents!), max: money(p.price_max_cents!) }),
    }));
  const steps = [
    "account",
    "company",
    "services",
    "area",
    "trucks",
    "documents",
    "profile",
    "wallet",
    "agreements",
  ] as const;
  const fields = [
    "name",
    "phone",
    "legalName",
    "dot",
    "years",
    "radius",
    "trucks",
    "operators",
    "insurance",
    "insuranceExpiry",
    "license",
    "licenseExpiry",
    "description",
    "topUp",
    "terms",
    "fees",
  ] as const;
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <OnboardingWizard
        company={ctx.company}
        services={services}
        presets={topUpPresets.map((c) => ({ cents: c, label: money(c) }))}
        steps={steps.map((s) => ({ id: s, label: t(`steps.${s}`) }))}
        fields={Object.fromEntries(fields.map((f) => [f, t(`fields.${f}`)]))}
        labels={{
          progress: t("progress"),
          back: t("back"),
          next: t("next"),
          submit: t("submit"),
          saved: t("saved"),
          stepOf: t("stepOf"),
          required: t("required"),
          outside: t("outside"),
          miles: t("miles"),
          nextTitle: t("nextTitle"),
          next1: t("next1"),
          next2: t("next2"),
          next3: t("next3"),
          review: t("review"),
          edit: t("edit"),
          stripe: t("stripe"),
        }}
      />
    </main>
  );
}
