import { serviceIcons, type ServiceIconKey } from "@rsos/ui/icons";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ui } from "@/lib/ui-classes";
import { serviceName } from "./service-label";

type Tile = { slug: string; name: string; icon_key: string };

/**
 * The emergency-first hero (RSOS-100): above the fold on a 375 x 667 phone there is only the
 * headline, one sentence, the real availability line (hidden without data), six service tiles
 * that start a request with that service chosen (straight to the location step), one full-width
 * "Get help now" and the 911 line. The phone action bar stays hidden while this is on screen.
 */
export async function EmergencyHero({
  headline,
  services,
  marketSlug,
  city,
  providerCount,
}: {
  headline: string;
  services: Tile[];
  marketSlug: string | null;
  city: string | null;
  /** Real active, non-demo providers in the market; null or 0 hides the line. */
  providerCount: number | null;
}) {
  const [t, ts] = await Promise.all([getTranslations("home.hero"), getTranslations("site")]);
  const withMarket = (path: string) =>
    marketSlug ? `${path}${path.includes("?") ? "&" : "?"}market=${marketSlug}` : path;
  return (
    <section
      data-hero
      aria-labelledby="hero-title"
      className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:pt-12"
    >
      <h1
        id="hero-title"
        className="max-w-3xl text-[2.125rem] leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl"
      >
        {headline}
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">{t("sub")}</p>
      {city && providerCount ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            {t("available", { count: providerCount, city })}
          </span>
          <Link href="/#cities-title" className="underline underline-offset-4">
            {t("changeCity")}
          </Link>
        </p>
      ) : null}
      <h2 className="sr-only">{t("tilesTitle")}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:max-w-4xl">
        {services.map((s) => {
          const Glyph = serviceIcons[s.icon_key as ServiceIconKey];
          return (
            <li key={s.slug}>
              <Link
                href={withMarket(`/get-help?service=${s.slug}`)}
                className="flex h-full min-h-24 flex-col justify-between gap-2 rounded-2xl border-2 border-border bg-surface p-4 text-lg leading-tight font-semibold shadow-sm transition-[border-color,box-shadow,transform] duration-150 ease-standard hover:border-input hover:shadow-md active:scale-[0.98] motion-reduce:transition-none"
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-xl bg-muted [&_svg]:size-6"
                >
                  {Glyph ? <Glyph /> : null}
                </span>
                {serviceName(ts, s, "tile")}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={withMarket("/get-help")}
        className={`${ui.button.primary} min-h-14 w-full text-lg lg:max-w-4xl`}
      >
        {t("getHelp")}
      </Link>
      <p className="text-sm font-medium">{t("safety")}</p>
    </section>
  );
}

/** "No sign-up · No membership · You pay the provider directly" (RSOS-100, first below the fold). */
export async function Reassurance() {
  const t = await getTranslations("home.reassure");
  return (
    <ul
      aria-label={t("label")}
      className="grid gap-2 rounded-2xl border bg-card p-4 text-center font-medium sm:grid-cols-3"
    >
      {(["noSignup", "noMembership", "payDirect"] as const).map((k) => (
        <li key={k}>{t(k)}</li>
      ))}
    </ul>
  );
}
