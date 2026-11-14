import { isDemoMode } from "@rsos/config/demo";
import { demoDriverProfile } from "@rsos/core/demo";
import { Alert } from "@rsos/ui/alert";
import { inputClass } from "@rsos/ui/input";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/site/page-hero";
import { serviceName } from "@/components/site/service-label";
import { SitePage } from "@/components/site/site-page";
import { DRIVER_COOKIE, readDriverSession } from "@/lib/driver-account";
import { formatPhone } from "@/lib/market";
import { pageMetadata } from "@/lib/seo";
import { ui } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("driverAccount");
  return pageMetadata({ title: t("title"), path: "/account", noindex: true });
}

const TABS = ["requests", "vehicles", "places", "favorites", "settings"] as const;

/**
 * Driver account (RSOS-070, demo mode only until driver accounts have tables): phone-code sign-in,
 * request history, saved vehicles and places, favorite providers, delete account, quick request.
 */
export default async function DriverAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!isDemoMode()) notFound();
  const sp = await searchParams;
  const [t, ts, f, store] = await Promise.all([
    getTranslations("driverAccount"),
    getTranslations("site"),
    getFormatter(),
    cookies(),
  ]);
  const session = readDriverSession(store.get(DRIVER_COOKIE)?.value);
  const card = "rounded-2xl border bg-card p-4";
  const row = "flex flex-wrap items-center justify-between gap-3 py-3";

  if (!session?.signedIn) {
    return (
      <SitePage>
        <PageHero title={t("signIn.title")} intro={t("signIn.body")} />
        <div className="mx-auto flex max-w-md flex-col gap-4 px-4">
          <p className="text-sm text-muted-foreground">{t("demoOnly")}</p>
          {sp.error === "code" ? <Alert tone="critical" title={t("signIn.wrong")} /> : null}
          {session && !session.signedIn ? (
            <form method="post" action="/api/account" className="flex flex-col gap-4">
              <input type="hidden" name="action" value="verify" />
              {sp.code ? (
                <p className="rounded-xl bg-warning-subtle p-3 text-sm font-medium text-warning-strong">
                  {t("signIn.demoCode", { code: sp.code })}
                </p>
              ) : null}
              <label className="flex flex-col gap-2 font-medium">
                {t("signIn.code")}
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  className={`${inputClass} text-2xl tracking-[0.5em]`}
                />
              </label>
              <button type="submit" className={`${ui.button.primary} self-start`}>
                {t("signIn.verify")}
              </button>
            </form>
          ) : (
            <form method="post" action="/api/account" className="flex flex-col gap-4">
              <input type="hidden" name="action" value="send-code" />
              <label className="flex flex-col gap-2 font-medium">
                {t("signIn.phone")}
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className={inputClass}
                />
              </label>
              <button type="submit" className={`${ui.button.primary} self-start`}>
                {t("signIn.send")}
              </button>
            </form>
          )}
        </div>
      </SitePage>
    );
  }

  const tab = TABS.find((x) => x === sp.tab) ?? "requests";
  const p = demoDriverProfile(session.phone);
  const vehicles = p.vehicles
    .filter((v) => !session.removedVehicles.includes(v.id))
    .map((v) => ({ ...v, isDefault: v.id === (session.defaultVehicle ?? "v0") }));
  const places = p.places.filter((x) => !session.removedPlaces.includes(x.id));
  const favorites = p.favorites.filter((x) => !session.removedFavorites.includes(x.slug));
  const action = (
    name: string,
    id: string,
    label: string,
    variant: "outline" | "ghost" = "ghost",
  ) => (
    <form method="post" action="/api/account">
      <input type="hidden" name="action" value={name} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`${ui.button[variant]} px-3 text-sm`}>
        {label}
      </button>
    </form>
  );
  return (
    <SitePage>
      <PageHero title={t("title")} intro={formatPhone(session.phone)} />
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4">
        <section className={`${card} flex flex-col gap-3`} aria-labelledby="quick-h">
          <h2 id="quick-h" className="text-xl font-semibold">
            {t("quick.title")}
          </h2>
          <p className="text-muted-foreground">{t("quick.body")}</p>
          <form
            method="post"
            action="/api/account"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            <input type="hidden" name="action" value="quick" />
            {["flat-tire", "wont-start", "locked-out", "out-of-gas", "tow"].map((s) => (
              <button
                key={s}
                type="submit"
                name="service"
                value={s}
                className={`${ui.button.outline} min-h-14`}
              >
                {serviceName(ts, { slug: s, name: s })}
              </button>
            ))}
          </form>
        </section>
        <nav aria-label={t("tabs")} className="flex gap-1 overflow-x-auto border-b">
          {TABS.map((x) => (
            <Link
              key={x}
              href={`/account?tab=${x}`}
              aria-current={x === tab ? "page" : undefined}
              className="inline-flex min-h-touch items-center border-b-2 border-transparent px-3 font-medium whitespace-nowrap aria-[current=page]:border-primary"
            >
              {t(x)}
            </Link>
          ))}
        </nav>
        {tab === "requests" ? (
          <ul className={`${card} divide-y`}>
            {p.history.map((h) => (
              <li key={h.token} className={row}>
                <div>
                  <Link
                    href={`/r/${h.token}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {serviceName(ts, { slug: h.serviceSlug, name: h.serviceSlug })}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {h.providerName} ·{" "}
                    {f.number(h.priceCents / 100, { style: "currency", currency: "USD" })} ·{" "}
                    {t("history.daysAgo", { days: h.daysAgo })}
                  </p>
                </div>
                <form method="post" action="/api/account">
                  <input type="hidden" name="action" value="quick" />
                  <button
                    type="submit"
                    name="service"
                    value={h.serviceSlug}
                    className={`${ui.button.outline} px-3 text-sm`}
                  >
                    {t("history.again")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "vehicles" ? (
          <ul className={`${card} divide-y`}>
            {vehicles.map((v) => (
              <li key={v.id} className={row}>
                <p className="font-medium">
                  {v.year} {v.make} {v.model} · {v.color}{" "}
                  {v.isDefault ? (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {t("vehicle.default")}
                    </span>
                  ) : null}
                </p>
                <div className="flex gap-1">
                  {v.isDefault ? null : action("default-vehicle", v.id, t("vehicle.makeDefault"))}
                  {action("remove-vehicle", v.id, t("vehicle.remove"))}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "places" ? (
          <ul className={`${card} divide-y`}>
            {places.map((x) => (
              <li key={x.id} className={row}>
                <p className="font-medium">
                  {x.label} · {x.area}
                </p>
                {action("remove-place", x.id, t("place.remove"))}
              </li>
            ))}
          </ul>
        ) : null}
        {tab === "favorites" ? (
          favorites.length ? (
            <ul className={`${card} divide-y`}>
              {favorites.map((x) => (
                <li key={x.slug} className={row}>
                  <Link
                    href={`/providers/${x.slug}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {x.name}
                  </Link>
                  {action("remove-favorite", x.slug, t("favorite.remove"))}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("favorite.none")}</p>
          )
        ) : null}
        {tab === "settings" ? (
          <section className={`${card} flex flex-col gap-3`} aria-labelledby="del-h">
            <h2 id="del-h" className="text-xl font-semibold">
              {t("delete.title")}
            </h2>
            <p>{t("delete.body")}</p>
            <form method="post" action="/api/account" className="flex flex-col gap-3">
              <input type="hidden" name="action" value="delete" />
              <label className="flex flex-col gap-2 font-medium">
                {t("delete.confirm")}
                <input name="confirm" required autoComplete="off" className={inputClass} />
              </label>
              <button
                type="submit"
                className={`${ui.button.outline} self-start border-destructive text-destructive`}
              >
                {t("delete.button")}
              </button>
            </form>
            <form method="post" action="/api/account">
              <input type="hidden" name="action" value="sign-out" />
              <button type="submit" className={`${ui.button.ghost} px-3`}>
                {t("signOut")}
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </SitePage>
  );
}
