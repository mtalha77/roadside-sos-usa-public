import { isDemoMode } from "@rsos/config/demo";
import {
  type DemoRequest,
  demoRequestFromToken,
  makeDemoRequest,
  seedFrom,
  typicalPriceCents,
} from "@rsos/core/demo";
import { Button } from "@rsos/ui/button";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import { RequestLive } from "@/components/request/request-live";
import { formatPhone } from "@/lib/market";
import { getRealRequest } from "@/lib/request-status";
import { pageMetadata } from "@/lib/seo";
import { getFeaturedRules, getMarkets, getMarketServices, getMarketStats } from "@/lib/site-data";
import { phonesEnabled } from "@/lib/phones";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = await getTranslations("site.placeholder");
  return pageMetadata({
    title: t("trackTitle"),
    path: `/r/${(await params).token}`,
    noindex: true,
  });
}

/** Price ranges (cents) for a market, so simulated quotes stay inside real local prices. */
async function rangesFor(market: string) {
  const rows = await getMarketServices(market);
  return Object.fromEntries(
    rows
      .filter((r) => r.price_min_cents !== null)
      .map((r) => [r.service_slug, { min: r.price_min_cents!, max: r.price_max_cents! }]),
  );
}

/** Simulated providers in demo mode: for a real request (seeded by its token) or a demo token. */
async function loadSimulation(
  token: string,
  real: Awaited<ReturnType<typeof getRealRequest>>,
): Promise<DemoRequest | null> {
  if (!isDemoMode()) return null;
  if (real) {
    const created = Date.parse(real.submitted_at ?? real.created_at);
    const base = makeDemoRequest(
      real.market_slug,
      seedFrom(token),
      created,
      await rangesFor(real.market_slug),
    );
    return base
      ? {
          ...base,
          serviceSlug: real.service_slug as DemoRequest["serviceSlug"],
          outcome: "completed",
        }
      : null;
  }
  return demoRequestFromToken(token, Date.now());
}

/**
 * Request status (RSOS-022, 065 to 069). Real requests show their real stage; in demo mode a real
 * request also gets simulated providers (clearly labelled) so the whole journey can be seen, and
 * demo tokens play the demo scenario.
 */
export default async function RequestPage({ params }: Params) {
  const { token } = await params;
  const [t, ts, messages, markets, real] = await Promise.all([
    getTranslations("track"),
    getTranslations("site"),
    getMessages(),
    getMarkets(),
    getRealRequest(token),
  ]);
  const simulation = await loadSimulation(token, real);
  const marketSlug = real?.market_slug ?? simulation?.marketSlug;
  const market = markets.find((m) => m.slug === marketSlug) ?? null;
  // "Call us" only when phones are enabled (RSOS-100); the provider count only from real data.
  const phone = phonesEnabled() ? (market?.phone ?? null) : null;
  const [stats, prices, featuredRules] = marketSlug
    ? await Promise.all([
        getMarketStats(marketSlug),
        getMarketServices(marketSlug),
        getFeaturedRules(marketSlug),
      ])
    : [null, [], undefined];
  // Instant book starts at the market's typical price for this service (RSOS-109).
  const priceRow = prices.find(
    (p) => p.service_slug === (real?.service_slug ?? simulation?.serviceSlug),
  );
  const typicalCents =
    priceRow?.price_min_cents != null && priceRow.price_max_cents != null
      ? typicalPriceCents(priceRow.price_min_cents, priceRow.price_max_cents)
      : null;
  if (!real && !simulation) {
    return (
      <SitePage>
        <PageHero title={t("invalid.title")} intro={t("invalid.body")}>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/get-help">{t("invalid.again")}</Link>
            </Button>
            {phone ? (
              <Button asChild variant="outline">
                <a href={`tel:${phone}`}>{formatPhone(phone)}</a>
              </Button>
            ) : null}
          </div>
        </PageHero>
      </SitePage>
    );
  }
  const service = real
    ? serviceName(ts, { slug: real.service_slug, name: real.service_name })
    : serviceName(ts, { slug: simulation!.serviceSlug, name: simulation!.serviceSlug });
  return (
    // The request is sent: no "Get help now" bar on its status page.
    <SitePage marketSlug={marketSlug} bar={false}>
      <NextIntlClientProvider
        messages={{
          track: (messages as Record<string, unknown>).track as Record<string, unknown>,
          site: {
            services: (messages as { site: { services: Record<string, unknown> } }).site.services,
          },
        }}
      >
        {/* Geist Mono only on this page: the quote numbers, ETA and prices. */}
        <div className={GeistMono.variable}>
          <RequestLive
            token={token}
            code={real?.short_code ?? simulation!.code}
            serviceName={service}
            createdAt={
              real ? Date.parse(real.submitted_at ?? real.created_at) : simulation!.createdAt
            }
            realStatus={real?.status ?? null}
            simulation={simulation}
            supportPhone={phone ? formatPhone(phone) : null}
            typicalCents={typicalCents}
            featuredRules={featuredRules}
            reach={
              market && stats?.provider_count
                ? { count: stats.provider_count, city: market.name }
                : null
            }
          />
        </div>
      </NextIntlClientProvider>
    </SitePage>
  );
}
