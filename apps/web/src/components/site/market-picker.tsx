import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { cityLabel, type SiteMarket } from "@/lib/market";
import { ui } from "@/lib/ui-classes";

/** Lets the visitor change their area; a plain form post (no JavaScript). */
export async function MarketPicker({
  markets,
  current,
}: {
  markets: SiteMarket[];
  current: SiteMarket | null;
}) {
  const [t, h] = await Promise.all([getTranslations("site.market"), headers()]);
  return (
    <form method="post" action="/api/market" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="return" value={h.get("x-pathname") ?? "/"} />
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
      <button type="submit" className={ui.button.outline}>
        {t("save")}
      </button>
    </form>
  );
}
