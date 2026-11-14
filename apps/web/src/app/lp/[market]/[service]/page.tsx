import { brand } from "@rsos/config/brand";
import { formatPriceRange, type Locale } from "@rsos/i18n";
import { inputClass } from "@rsos/ui/input";
import { BadgeCheck, Clock, Phone, WalletCards } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { FaqList } from "@/components/site/faq-list";
import { LocateButton } from "@/components/get-help/locate-button";
import { serviceName } from "@/components/site/service-label";
import { ServiceLinks } from "@/components/site/service-links";
import { cityLabel, formatPhone } from "@/lib/market";
import { pageMetadata } from "@/lib/seo";
import { getMarkets, getMarketServices } from "@/lib/site-data";
import { ui } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ market: string; service: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

/** Headlines an ad may choose with `?h=` (an allowed list: ads can't put arbitrary text on the page). */
const LP_HEADLINES = ["fast", "price", "local", "stuck"] as const;

async function load(p: Params["params"]) {
  const { market, service } = await p;
  const m = (await getMarkets()).find((x) => x.slug === market);
  if (!m) return null;
  const services = await getMarketServices(m.slug);
  const svc = services.find((s) => s.service_slug === service && s.enabled);
  return svc ? { m, svc, services: services.filter((s) => s.enabled) } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load(params);
  const t = await getTranslations("lp");
  const { market, service } = await params;
  return pageMetadata({
    title: data ? t("metaTitle", { city: data.m.name }) : brand.name,
    path: `/lp/${market}/${service}`,
    noindex: true,
  });
}

/**
 * Ad landing page (RSOS-029): no menu, one job. Big tap-to-call, a headline from an allowed list,
 * the first request step on the first screen, trust row, local price range and 3 FAQs. Server
 * rendered with no client code except "Use my location"; never indexed.
 */
export default async function LandingPage({ params, searchParams }: Params) {
  const data = await load(params);
  if (!data) notFound();
  const sp = await searchParams;
  const { m, svc, services } = data;
  const [t, ts, locale] = await Promise.all([
    getTranslations("lp"),
    getTranslations("site"),
    getLocale(),
  ]);
  const name = serviceName(ts, { slug: svc.service_slug, name: svc.service_name });
  const h = LP_HEADLINES.find((x) => x === sp.h) ?? "fast";
  const keep = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "msclkid",
  ];
  const trust = [
    { icon: BadgeCheck, label: t("trust.insured") },
    { icon: Clock, label: t("trust.fast") },
    { icon: WalletCards, label: t("trust.noMembership") },
  ];
  return (
    <main id="main" className="min-h-dvh bg-background pb-28">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-lg font-bold">{brand.name}</span>
        {m.phone ? (
          <a href={`tel:${m.phone}`} className={`${ui.button.outline} px-3`}>
            <Phone aria-hidden="true" className="size-5" />
            <span className="tabular-nums">{formatPhone(m.phone)}</span>
          </a>
        ) : null}
      </header>
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-6">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          {t(`headlines.${h}`, { service: name, city: m.name })}
        </h1>
        {m.phone ? (
          <a href={`tel:${m.phone}`} className={`${ui.button.primary} min-h-14 w-full text-lg`}>
            <Phone aria-hidden="true" className="size-6" />
            {t("callNow", { phone: formatPhone(m.phone) })}
          </a>
        ) : null}
        <form
          method="post"
          action="/api/get-help"
          className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
        >
          <h2 className="text-xl font-semibold">{t("startTitle")}</h2>
          <input type="hidden" name="step" value="location" />
          <input type="hidden" name="service" value={svc.service_slug} />
          <input type="hidden" name="market" value={m.slug} />
          <input type="hidden" name="lat" defaultValue="" />
          <input type="hidden" name="lng" defaultValue="" />
          <input type="hidden" name="landing_page" value={`/lp/${m.slug}/${svc.service_slug}`} />
          {keep.map((k) =>
            sp[k] ? <input key={k} type="hidden" name={k} value={sp[k]!.slice(0, 200)} /> : null,
          )}
          <LocateButton
            label={t("useLocation")}
            busyLabel={t("locating")}
            deniedLabel={t("denied")}
            fallbackId="lp-address"
          />
          <label className="flex flex-col gap-2 font-medium">
            {t("address", { city: cityLabel(m) })}
            <input
              id="lp-address"
              name="address"
              autoComplete="street-address"
              className={inputClass}
            />
          </label>
          <button type="submit" className={`${ui.button.outline} self-start`}>
            {t("continue")}
          </button>
        </form>
        <ul aria-label={t("trust.label")} className="flex flex-col gap-2">
          {trust.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 font-medium">
              <Icon aria-hidden="true" className="size-5 text-success-strong" />
              {label}
            </li>
          ))}
        </ul>
        {svc.price_min_cents !== null && svc.price_max_cents !== null ? (
          <p className="rounded-2xl border bg-card p-4">
            <span className="block text-sm text-muted-foreground">
              {t("priceLabel", { service: name, city: m.name })}
            </span>
            <span className="text-2xl font-semibold tabular-nums">
              {formatPriceRange(svc.price_min_cents, svc.price_max_cents, locale as Locale)}
            </span>
          </p>
        ) : null}
        <section aria-labelledby="lp-other" className="flex flex-col gap-3">
          <h2 id="lp-other" className="text-lg font-semibold">
            {t("otherServices")}
          </h2>
          <ServiceLinks
            services={services
              .filter((s) => s.service_slug !== svc.service_slug)
              .map((s) => ({ slug: s.service_slug, name: s.service_name, icon_key: s.icon_key }))}
            marketSlug={m.slug}
          />
        </section>
        <FaqList
          items={(["cost", "fast", "membership"] as const).map((id) => ({
            id: `lp-${id}`,
            q: t(`faq.${id}.q`),
            a: t(`faq.${id}.a`),
          }))}
          withSchema={false}
        />
      </div>
      {m.phone ? (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <a href={`tel:${m.phone}`} className={`${ui.button.primary} w-full`}>
            <Phone aria-hidden="true" className="size-5" />
            {t("callNow", { phone: formatPhone(m.phone) })}
          </a>
        </div>
      ) : null}
    </main>
  );
}
