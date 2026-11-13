import { brand } from "@rsos/config/brand";
import { Button } from "@rsos/ui/button";
import { ChevronDown, Menu, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { cityLabel, formatPhone, marketPath, type SiteMarket } from "@/lib/market";
import type { SiteService } from "@/lib/site-data";
import { serviceName } from "./service-label";

type Props = { markets: SiteMarket[]; services: SiteService[]; market: SiteMarket | null };

/**
 * Site header: logo, services and cities menus, For providers, tap-to-call with the visitor's
 * market number, and Get help now. Menus are native disclosures (no JavaScript needed).
 */
export async function SiteHeader({ markets, services, market }: Props) {
  const t = await getTranslations("site");
  const offered = services.filter((s) => s.market_count > 0);
  const menuItem = "flex min-h-touch items-center rounded-lg px-3 hover:bg-accent";
  const disclosure =
    "flex min-h-touch cursor-pointer list-none items-center gap-1 rounded-lg px-3 font-medium hover:bg-accent [&::-webkit-details-marker]:hidden";
  const panel =
    "absolute top-full left-0 z-40 mt-2 flex min-w-60 flex-col rounded-xl border bg-popover p-2 shadow-lg";
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link
          href="/"
          className="mr-auto flex min-h-touch items-center text-lg font-bold tracking-tight"
        >
          {brand.name}
        </Link>
        <nav aria-label={t("nav.mainNav")} className="hidden items-center gap-1 lg:flex">
          <details data-menu className="relative">
            <summary className={disclosure}>
              {t("nav.services")} <ChevronDown aria-hidden="true" className="size-4" />
            </summary>
            <ul className={panel}>
              {offered.map((s) => (
                <li key={s.slug}>
                  <Link className={menuItem} href={`/services/${s.slug}`}>
                    {serviceName(t, s)}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          <details data-menu className="relative">
            <summary className={disclosure}>
              {t("nav.cities")} <ChevronDown aria-hidden="true" className="size-4" />
            </summary>
            <ul className={panel}>
              {markets.map((m) => (
                <li key={m.slug}>
                  <Link className={menuItem} href={marketPath(m)}>
                    {cityLabel(m)}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          <Link className={menuItem + " font-medium"} href="/for-providers">
            {t("nav.forProviders")}
          </Link>
        </nav>
        {market?.phone ? (
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <a
              href={`tel:${market.phone}`}
              aria-label={t("nav.callMarket", { phone: formatPhone(market.phone) })}
            >
              <Phone aria-hidden="true" className="size-5" />
              <span className="tabular-nums">{formatPhone(market.phone)}</span>
            </a>
          </Button>
        ) : null}
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/get-help">{t("nav.getHelp")}</Link>
        </Button>
        <details data-menu className="relative lg:hidden">
          <summary
            className={disclosure + " min-w-touch justify-center"}
            aria-label={t("nav.menu")}
          >
            <Menu aria-hidden="true" className="size-6" />
          </summary>
          <nav
            aria-label={t("nav.mainNav")}
            className={panel + " right-0 left-auto w-[min(20rem,calc(100vw-2rem))]"}
          >
            <p className="px-3 pt-2 text-sm font-semibold text-muted-foreground">
              {t("nav.services")}
            </p>
            <ul>
              {offered.map((s) => (
                <li key={s.slug}>
                  <Link className={menuItem} href={`/services/${s.slug}`}>
                    {serviceName(t, s)}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="px-3 pt-2 text-sm font-semibold text-muted-foreground">
              {t("nav.cities")}
            </p>
            <ul>
              {markets.map((m) => (
                <li key={m.slug}>
                  <Link className={menuItem} href={marketPath(m)}>
                    {cityLabel(m)}
                  </Link>
                </li>
              ))}
            </ul>
            <Link className={menuItem + " mt-1 border-t font-medium"} href="/for-providers">
              {t("nav.forProviders")}
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
