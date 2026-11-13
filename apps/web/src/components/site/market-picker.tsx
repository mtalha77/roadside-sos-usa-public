import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { chooseMarketAction } from "@/lib/actions";
import { cityLabel, type SiteMarket } from "@/lib/market";

/** Lets the visitor change their area; works without JavaScript (plain form post). */
export async function MarketPicker({
  markets,
  current,
}: {
  markets: SiteMarket[];
  current: SiteMarket | null;
}) {
  const t = await getTranslations("site.market");
  return (
    <form action={chooseMarketAction} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <label htmlFor="market-select" className="text-sm font-medium">
          {current ? t("change") : t("choose")}
        </label>
        <select
          id="market-select"
          name="market"
          defaultValue={current?.slug ?? ""}
          className={inputClass}
          required
        >
          <option value="" disabled>
            {t("none")}
          </option>
          {markets.map((m) => (
            <option key={m.slug} value={m.slug}>
              {cityLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        {t("save")}
      </Button>
    </form>
  );
}
