import { getTranslations } from "next-intl/server";
import { cityLabel, marketPath, type SiteMarket } from "@/lib/market";
import Link from "next/link";
import { WaitlistForm } from "./waitlist-form";

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
      <WaitlistForm city={city} region={region} />
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
