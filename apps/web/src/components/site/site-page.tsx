import { getTranslations } from "next-intl/server";
import { DniSwap } from "./dni-swap";
import type { ReactNode } from "react";
import { getMarkets, getServices } from "@/lib/site-data";
import { getVisitorMarket } from "@/lib/visitor";
import { MobileBar } from "./mobile-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Page frame for the public website: skip link, header, main, footer and the phone bottom bar.
 * `marketSlug` is the market of the page being shown (city pages); it wins over cookie and IP.
 */
export async function SitePage({
  marketSlug,
  bar = true,
  children,
}: {
  marketSlug?: string | null;
  /** The phone action bar; off in the request flow, whose own button sits in the thumb zone. */
  bar?: boolean;
  children: ReactNode;
}) {
  const [markets, services, detection, t] = await Promise.all([
    getMarkets(),
    getServices(),
    getVisitorMarket(marketSlug),
    getTranslations("common"),
  ]);
  const market = detection.kind === "market" ? detection.market : null;
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader markets={markets} services={services} market={market} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter markets={markets} services={services} market={market} />
      <DniSwap />
      <div aria-hidden="true" className="pb-32 sm:pb-6" />
      {bar ? <MobileBar market={market} /> : null}
    </>
  );
}
