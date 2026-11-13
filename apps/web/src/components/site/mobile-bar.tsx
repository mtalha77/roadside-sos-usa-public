import { Button } from "@rsos/ui/button";
import { Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatPhone, type SiteMarket } from "@/lib/market";

/** Phones: sticky bottom bar with Call (when the market has a number) and Get help now. */
export async function MobileBar({ market }: { market: SiteMarket | null }) {
  const t = await getTranslations("site.nav");
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
      <div className="flex gap-3">
        {market?.phone ? (
          <Button asChild variant="outline" className="flex-1">
            <a
              href={`tel:${market.phone}`}
              aria-label={t("callMarket", { phone: formatPhone(market.phone) })}
            >
              <Phone aria-hidden="true" className="size-5" />
              {t("call")}
            </a>
          </Button>
        ) : null}
        <Button asChild className="flex-[2]">
          <Link href="/get-help">{t("getHelp")}</Link>
        </Button>
      </div>
    </div>
  );
}
