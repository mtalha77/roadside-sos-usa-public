import { formatPriceRange, type Locale } from "@rsos/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { MarketService } from "@/lib/site-data";
import { serviceName } from "./service-label";

/** Typical price ranges per service for a market, straight from `market_services`. */
export async function PriceList({
  services,
  city,
  hrefFor,
  headingLevel = 2,
}: {
  services: MarketService[];
  city: string;
  hrefFor?: (slug: string) => string;
  headingLevel?: 2 | 3;
}) {
  const [t, ts, locale] = await Promise.all([
    getTranslations("home.prices"),
    getTranslations("site"),
    getLocale(),
  ]);
  const rows = services.filter(
    (s) => s.enabled && s.price_min_cents !== null && s.price_max_cents !== null,
  );
  if (!rows.length) return null;
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby="prices-title" className="flex flex-col gap-3">
      <H id="prices-title" className="text-2xl font-semibold">
        {t("title", { city })}
      </H>
      <dl className="divide-y rounded-2xl border bg-card">
        {rows.map((s) => {
          const name = serviceName(ts, { slug: s.service_slug, name: s.service_name });
          return (
            <div
              key={s.service_slug}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
            >
              <dt className="font-medium">
                {hrefFor ? (
                  <Link
                    className="inline-flex min-h-touch items-center underline-offset-4 hover:underline"
                    href={hrefFor(s.service_slug)}
                  >
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </dt>
              <dd className="text-right tabular-nums">
                <span className="font-semibold">
                  {formatPriceRange(s.price_min_cents!, s.price_max_cents!, locale as Locale)}
                </span>
                {s.price_note && t.has(s.price_note) ? (
                  <span className="block text-sm text-muted-foreground">{t(s.price_note)}</span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-sm text-muted-foreground">{t("note", { city })}</p>
    </section>
  );
}
