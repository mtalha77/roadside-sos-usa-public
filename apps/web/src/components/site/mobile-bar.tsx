import { Button } from "@rsos/ui/button";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatPhone, type SiteMarket } from "@/lib/market";
import { phonesEnabled } from "@/lib/phones";

/**
 * Phones: sticky bottom bar. Booking comes first (RSOS-108): a full-width Get help now, and only a
 * small "Prefer to call?" link below it when phones are enabled and the market has a number. Safe-area aware. On pages with an emergency hero it appears only once the hero
 * scrolls away (the site script sets `html[data-hero=visible]` while the hero is on screen).
 */
export async function MobileBar({ market }: { market: SiteMarket | null }) {
  const t = await getTranslations("site.nav");
  const phone = phonesEnabled() ? market?.phone : null;
  return (
    <div
      data-mobile-bar
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 ease-standard motion-reduce:transition-none sm:hidden [html[data-hero=visible]_&]:invisible [html[data-hero=visible]_&]:translate-y-full"
    >
      <Button asChild className="w-full">
        <Link href={market ? `/get-help?market=${market.slug}` : "/get-help"}>{t("getHelp")}</Link>
      </Button>
      {market && phone ? (
        <a
          href={`tel:${phone}`}
          data-dni={market.slug}
          aria-label={t("callMarket", { phone: formatPhone(phone) })}
          className="mt-1 flex min-h-10 items-center justify-center gap-1 text-sm text-muted-foreground underline underline-offset-4"
        >
          {t("preferCall")}{" "}
          <span className="tabular-nums" data-dni-text>
            {formatPhone(phone)}
          </span>
        </a>
      ) : null}
    </div>
  );
}
