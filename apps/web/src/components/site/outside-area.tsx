import { getTranslations } from "next-intl/server";
import { cityLabel, marketPath, type SiteMarket } from "@/lib/market";
import Link from "next/link";
import { MarketPicker } from "./market-picker";
import dynamic from "next/dynamic";

// Only visitors outside every market see this form, so its code is a separate chunk.
const WaitlistForm = dynamic(() => import("./waitlist-form").then((m) => m.WaitlistForm));

/** Shown instead of the request flow when the visitor is outside every market. Never a dead end. */
export async function OutsideArea({
  city,
  region,
  markets,
}: {
  city: string | null;
  region: string | null;
  markets: SiteMarket[];
}) {
  const t = await getTranslations("site.market");
  return (
    <section
      aria-labelledby="outside-title"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm"
    >
      <h2 id="outside-title" className="text-2xl font-semibold">
        {t("outsideTitle")}
      </h2>
      <p>{city ? t("outsideBodyCity", { city }) : t("outsideBody")}</p>
      <p className="font-medium">{t("emergency")}</p>
      <WaitlistForm
        city={city}
        region={region}
        labels={{
          email: t("email"),
          zip: t("zip"),
          join: t("join"),
          joined: t("joined"),
          "errors.email": t("errors.email"),
          "errors.zip": t("errors.zip"),
          "errors.limit": t("errors.limit"),
          "errors.generic": t("errors.generic"),
        }}
      />
      {/* IP locations are often wrong: let the visitor pick their city anyway. */}
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
