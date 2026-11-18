import { Button } from "@rsos/ui/button";
import { Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatPhone, type SiteMarket } from "@/lib/market";
import { phonesEnabled } from "@/lib/phones";

/**
 * Phones: sticky bottom bar with Call (when phones are enabled and the market has a number) and
 * Get help now. Safe-area aware. On pages with an emergency hero it appears only once the hero
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
      <div className="flex gap-3">
        {market && phone ? (
          <Button asChild variant="outline" className="flex-1">
            <a
              href={`tel:${phone}`}
              data-dni={market.slug}
              aria-label={t("callMarket", { phone: formatPhone(phone) })}
            >
              <Phone aria-hidden="true" className="size-5" />
              {t("call")}
            </a>
          </Button>
        ) : null}
        <Button asChild className="flex-[2]">
          <Link href={market ? `/get-help?market=${market.slug}` : "/get-help"}>
            {t("getHelp")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
