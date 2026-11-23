import { isDemoMode } from "@rsos/config/demo";
import { demoMarkets } from "@rsos/config/demo-fixtures";
import { demoProviders, rng, seedFrom } from "@rsos/core/demo";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Avatar } from "@rsos/ui/avatar";
import { LiteMap } from "@rsos/ui/lite-map";
import { BadgeCheck, Clock, ShieldCheck, Star } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import { cityLabel } from "@/lib/market";
import { pageMetadata } from "@/lib/seo";
import { getMarkets, getMarketServices } from "@/lib/site-data";
import { ui } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/** A demo provider by slug (demo mode only; real providers get public profiles when they exist). */
function findDemoProvider(slug: string) {
  if (!isDemoMode()) return null;
  for (const market of Object.keys(demoMarkets)) {
    const p = demoProviders(market).find((x) => x.slug === slug);
    if (p) return p;
  }
  return null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = findDemoProvider(slug);
  return pageMetadata({ title: p?.name ?? "Provider", path: `/providers/${slug}`, noindex: true });
}

/**
 * Public provider profile (RSOS-019b). Demo providers in demo mode only; in production the page is
 * hidden (404) until real providers have profiles. Fictional data, clearly marked.
 */
export default async function ProviderProfilePage({ params }: Params) {
  const { slug } = await params;
  const p = findDemoProvider(slug);
  if (!p) notFound();
  const [t, ts, locale, markets, services] = await Promise.all([
    getTranslations("providerProfile"),
    getTranslations("site"),
    getLocale(),
    getMarkets(),
    getMarketServices(p.marketSlug),
  ]);
  const market = markets.find((m) => m.slug === p.marketSlug);
  const r = rng(seedFrom(p.slug));
  const offered = services.filter(
    (s) => s.enabled && s.price_min_cents !== null && s.price_max_cents !== null,
  );
  const priced = offered.map((s) => ({
    ...s,
    price:
      Math.round((s.price_min_cents! + r() * (s.price_max_cents! - s.price_min_cents!)) / 500) *
      500,
  }));
  const radius = 15 + Math.floor(r() * 15);
  const eta = 18 + Math.floor(r() * 15);
  const reviews = p.rating
    ? (t.raw("demoReviews") as { name: string; text: string; stars: number }[]).slice(0, 3)
    : [];
  const card = "rounded-2xl border bg-card p-5";
  return (
    <SitePage marketSlug={p.marketSlug}>
      <Breadcrumbs items={[{ href: `/providers/${p.slug}`, label: p.name }]} />
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pt-4">
        <div
          aria-hidden="true"
          className="h-32 rounded-2xl bg-[linear-gradient(135deg,var(--muted),var(--surface))] sm:h-44"
        />
        <header className="-mt-14 flex flex-wrap items-end gap-4 px-2">
          <Avatar name={p.name} size="lg" className="border-4 border-background" />
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
            <p className="text-muted-foreground">
              {market ? cityLabel(market) : null} · {t("based", { area: p.area })}
            </p>
          </div>
        </header>
        <p className="rounded-xl bg-warning-subtle p-3 text-sm font-medium text-warning-strong">
          {t("demoNote")}
        </p>
        <ul className="flex flex-wrap gap-2">
          <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium">
            <ShieldCheck aria-hidden="true" className="size-4 text-success-strong" /> {t("insured")}
          </li>
          {p.marketSlug !== "las-vegas" ? (
            <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium">
              <BadgeCheck aria-hidden="true" className="size-4 text-success-strong" />{" "}
              {t("licensed")}
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium">
            <Clock aria-hidden="true" className="size-4" /> {t("eta", { minutes: eta })}
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium">
            <Star aria-hidden="true" className="size-4" />{" "}
            {p.rating
              ? t("rating", { rating: p.rating.toFixed(1), count: p.reviews })
              : t("newProvider")}
          </li>
        </ul>
        <div className="grid gap-6 md:grid-cols-2">
          <section className={card} aria-labelledby="pp-services">
            <h2 id="pp-services" className="mb-3 text-xl font-semibold">
              {t("services")}
            </h2>
            <dl className="divide-y">
              {priced.map((s) => (
                <div key={s.service_slug} className="flex justify-between gap-3 py-2">
                  <dt>{serviceName(ts, { slug: s.service_slug, name: s.service_name })}</dt>
                  <dd className="font-semibold tabular-nums">
                    {t("from", { price: formatCurrency(s.price, locale as Locale) })}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={card} aria-labelledby="pp-area">
            <h2 id="pp-area" className="mb-3 text-xl font-semibold">
              {t("area", { miles: radius })}
            </h2>
            <LiteMap
              label={t("areaMap", { miles: radius })}
              radius={{ center: p.home, miles: radius }}
              points={[
                { id: "base", kind: "provider", lat: p.home.lat, lng: p.home.lng, label: p.area },
              ]}
            />
          </section>
          <section className={card} aria-labelledby="pp-hours">
            <h2 id="pp-hours" className="mb-2 text-xl font-semibold">
              {t("hours")}
            </h2>
            <p>{p.trucks >= 4 ? t("hours24") : t("hoursDay")}</p>
            <h3 className="mt-4 mb-2 font-semibold">{t("payments")}</h3>
            <p>{t("paymentList")}</p>
            <h3 className="mt-4 mb-2 font-semibold">{t("photos")}</h3>
            <p className="text-muted-foreground">{t("noPhotos")}</p>
          </section>
          <section className={card} aria-labelledby="pp-reviews">
            <h2 id="pp-reviews" className="mb-3 text-xl font-semibold">
              {t("reviews")}
            </h2>
            {reviews.length ? (
              <ul className="flex flex-col gap-3">
                {reviews.map((rv) => (
                  <li key={rv.name}>
                    <p className="font-medium">
                      {rv.name} · {t("stars", { count: rv.stars })}
                    </p>
                    <p className="text-muted-foreground">{rv.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("noReviews")}</p>
            )}
          </section>
        </div>
        <Link
          href={`/get-help?market=${p.marketSlug}`}
          className={`${ui.button.primary} self-start`}
        >
          {ts("nav.getHelp")}
        </Link>
      </div>
    </SitePage>
  );
}
