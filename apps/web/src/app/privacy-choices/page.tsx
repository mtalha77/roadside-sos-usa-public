import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { SitePage } from "@/components/site/site-page";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { safeReturn } from "@/lib/return-path";
import { pageMetadata } from "@/lib/seo";
import { ui } from "@/lib/ui-classes";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("consent");
  return pageMetadata({ title: t("title"), path: "/privacy-choices", noindex: true });
}

/** "Your privacy choices": change cookie settings any time (works without JavaScript). */
export default async function PrivacyChoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const [t, store, h, sp] = await Promise.all([
    getTranslations("consent"),
    cookies(),
    headers(),
    searchParams,
  ]);
  const current = parseConsent(store.get(CONSENT_COOKIE)?.value);
  const gpc = h.get("sec-gpc") === "1";
  const rows = [
    { name: null, label: t("necessary"), hint: t("necessaryHint"), checked: true, disabled: true },
    {
      name: "analytics",
      label: t("analytics"),
      hint: t("analyticsHint"),
      checked: current?.a ?? false,
      disabled: false,
    },
    {
      name: "ads",
      label: t("ads"),
      hint: t("adsHint"),
      checked: (current?.d ?? false) && !gpc,
      disabled: gpc,
    },
  ];
  return (
    <SitePage>
      <PageHero title={t("title")} intro={t("body")} />
      <form
        method="post"
        action="/api/consent"
        className="mx-auto flex max-w-2xl flex-col gap-5 px-4"
      >
        <input type="hidden" name="return" value={safeReturn(sp.return)} />
        <input type="hidden" name="choice" value="save" />
        {gpc ? <p className="font-medium">{t("gpc")}</p> : null}
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-4 p-4">
              <label htmlFor={`pc-${r.label}`} className="flex-1 cursor-pointer">
                <span className="font-medium">{r.label}</span>
                <span className="block text-sm text-muted-foreground">{r.hint}</span>
              </label>
              <input
                id={`pc-${r.label}`}
                type="checkbox"
                role="switch"
                name={r.name ?? undefined}
                defaultChecked={r.checked}
                disabled={r.disabled}
                className={ui.switch}
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={ui.button.primary}>
            {t("save")}
          </button>
          <Link
            className="inline-flex min-h-touch items-center underline underline-offset-4"
            href="/legal/cookies"
          >
            {t("policy")}
          </Link>
        </div>
      </form>
    </SitePage>
  );
}
