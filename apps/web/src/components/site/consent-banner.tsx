import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { CONSENT_COOKIE, needsChoice, parseConsent } from "@/lib/consent";
import { ui } from "@/lib/ui-classes";

/**
 * Cookie banner for visitors who have not chosen yet (or chose under an older policy). Plain forms:
 * it works without JavaScript and costs none. "Choose" opens the privacy choices page.
 */
export async function ConsentBanner() {
  const [store, h] = await Promise.all([cookies(), headers()]);
  if (!needsChoice(parseConsent(store.get(CONSENT_COOKIE)?.value))) return null;
  const t = await getTranslations("consent");
  const here = h.get("x-pathname") ?? "/";
  if (here.startsWith("/privacy-choices")) return null;
  return (
    <section
      aria-labelledby="consent-title"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl animate-slide-up flex-col gap-4 rounded-2xl border bg-popover p-5 text-popover-foreground shadow-lg sm:bottom-6"
    >
      <h2 id="consent-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm">
        {t("body")}{" "}
        <Link className="underline underline-offset-4" href="/legal/cookies">
          {t("policy")}
        </Link>
      </p>
      {h.get("sec-gpc") === "1" ? <p className="text-sm font-medium">{t("gpc")}</p> : null}
      <form method="post" action="/api/consent" className="flex flex-wrap gap-2">
        <input type="hidden" name="return" value={here} />
        <Link
          className={ui.button.outline}
          href={`/privacy-choices?return=${encodeURIComponent(here)}`}
        >
          {t("manage")}
        </Link>
        <button type="submit" name="choice" value="reject" className={ui.button.outline}>
          {t("rejectAll")}
        </button>
        <button type="submit" name="choice" value="accept" className={ui.button.outline}>
          {t("acceptAll")}
        </button>
      </form>
    </section>
  );
}
