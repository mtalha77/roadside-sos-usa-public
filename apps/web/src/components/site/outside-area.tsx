import { Alert } from "@rsos/ui/alert";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { cityLabel, marketPath, type SiteMarket } from "@/lib/market";
import { ui } from "@/lib/ui-classes";
import { WAITLIST_FLASH, WAITLIST_RESULTS, type WaitlistResult } from "@/lib/waitlist";
import { MarketPicker } from "./market-picker";

/**
 * Shown instead of the request flow when the visitor is outside every market: a waitlist form and
 * a city picker (IP locations are often wrong). Never a dead end. Plain forms, no JavaScript.
 */
export async function OutsideArea({
  city,
  region,
  markets,
}: {
  city: string | null;
  region: string | null;
  markets: SiteMarket[];
}) {
  const [t, store, h] = await Promise.all([getTranslations("site.market"), cookies(), headers()]);
  const flash = store.get(WAITLIST_FLASH)?.value as WaitlistResult | undefined;
  const result = flash && WAITLIST_RESULTS.includes(flash) ? flash : null;
  const here = h.get("x-pathname") ?? "/";
  return (
    <section
      id="waitlist"
      aria-labelledby="outside-title"
      className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <h2 id="outside-title" className="text-2xl font-semibold">
        {t("outsideTitle")}
      </h2>
      <p>{city ? t("outsideBodyCity", { city }) : t("outsideBody")}</p>
      <p className="font-medium">{t("emergency")}</p>
      {result === "joined" ? (
        <Alert tone="success" title={t("joined")} />
      ) : (
        <form method="post" action="/api/waitlist" className="flex flex-col gap-4">
          {result ? <Alert tone="critical" title={t(`errors.${result}`)} /> : null}
          <input type="hidden" name="return" value={here} />
          {city ? <input type="hidden" name="city" value={city} /> : null}
          {region ? <input type="hidden" name="region" value={region} /> : null}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-2">
              <label htmlFor="waitlist-email" className="font-medium">
                {t("email")}
              </label>
              <input
                id="waitlist-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="waitlist-zip" className="font-medium">
                {t("zip")}
              </label>
              <input
                id="waitlist-zip"
                name="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                pattern="[0-9]{5}"
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" className={`${ui.button.primary} self-start`}>
            {t("join")}
          </button>
        </form>
      )}
      {markets.length ? <MarketPicker markets={markets} current={null} /> : null}
      {markets.length ? (
        <div>
          <h3 className="mb-2 font-semibold">{t("servedCities")}</h3>
          <ul className="flex flex-wrap gap-x-4">
            {markets.map((m) => (
              <li key={m.slug}>
                <Link
                  className="inline-flex min-h-touch items-center underline underline-offset-4"
                  href={marketPath(m)}
                >
                  {cityLabel(m)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
