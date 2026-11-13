"use client";

import { Button } from "@rsos/ui/button";
import { Switch } from "@rsos/ui/switch";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import { recordConsentAction } from "@/lib/consent-action";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  type ConsentChoice,
  consentModeState,
  COOKIE_POLICY_VERSION,
  needsChoice,
  parseConsent,
} from "@/lib/consent";

export const OPEN_PRIVACY_CHOICES = "rsos:privacy-choices";
const CHANGED = "rsos:consent-changed";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

const readCookie = () =>
  parseConsent(document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]+)`))?.[1]);
const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGED, cb);
  return () => window.removeEventListener(CHANGED, cb);
};
const getSnapshot = () =>
  document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]+)`))?.[1] ?? "";
const getServerSnapshot = () => null;

/**
 * Cookie banner and preferences ("Your privacy choices"). Necessary cookies are always on;
 * analytics and advertising only with consent; a Global Privacy Control signal keeps advertising
 * off. Analytics tags render only after consent (`analyticsAllowed`).
 */
export function ConsentManager({ analyticsTags }: { analyticsTags: boolean }) {
  const t = useTranslations("consent");
  const id = useId();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const choice: ConsentChoice | null = raw === null ? null : parseConsent(raw);
  const gpc = typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const show = () => {
      const c = readCookie();
      setAnalytics(c?.a ?? false);
      setAds(c?.d ?? false);
      setDetails(true);
      setSaved(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_PRIVACY_CHOICES, show);
    return () => window.removeEventListener(OPEN_PRIVACY_CHOICES, show);
  }, []);

  const save = useCallback(
    (a: boolean, d: boolean) => {
      const next: ConsentChoice = { v: COOKIE_POLICY_VERSION, a, d: d && !gpc, gpc };
      document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      window.gtag?.("consent", "update", consentModeState(next, gpc));
      window.dispatchEvent(new Event(CHANGED));
      void recordConsentAction({ analytics: next.a, ads: next.d, gpc });
      setSaved(true);
      setOpen(false);
    },
    [gpc],
  );

  const pending = raw !== null && needsChoice(choice);
  const visible = open || pending;
  return (
    <>
      {analyticsTags && choice?.a ? (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      ) : null}
      {saved ? (
        <p role="status" className="sr-only">
          {t("saved")}
        </p>
      ) : null}
      {visible ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-title`}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl animate-slide-up flex-col gap-4 rounded-2xl border bg-popover p-5 text-popover-foreground shadow-lg sm:bottom-6"
        >
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm">
            {t("body")}{" "}
            <Link className="underline underline-offset-4" href="/legal/cookies">
              {t("policy")}
            </Link>
          </p>
          {gpc ? <p className="text-sm font-medium">{t("gpc")}</p> : null}
          {details ? (
            <ul className="flex flex-col gap-3">
              <li className="flex items-center justify-between gap-4">
                <span>
                  <span className="font-medium">{t("necessary")}</span>
                  <span className="block text-sm text-muted-foreground">{t("necessaryHint")}</span>
                </span>
                <Switch checked disabled aria-label={t("necessary")} />
              </li>
              <li className="flex items-center justify-between gap-4">
                <span>
                  <span className="font-medium">{t("analytics")}</span>
                  <span className="block text-sm text-muted-foreground">{t("analyticsHint")}</span>
                </span>
                <Switch
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                  aria-label={t("analytics")}
                />
              </li>
              <li className="flex items-center justify-between gap-4">
                <span>
                  <span className="font-medium">{t("ads")}</span>
                  <span className="block text-sm text-muted-foreground">{t("adsHint")}</span>
                </span>
                <Switch
                  checked={ads && !gpc}
                  disabled={gpc}
                  onCheckedChange={setAds}
                  aria-label={t("ads")}
                />
              </li>
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {details ? (
              <Button type="button" variant="outline" onClick={() => save(analytics, ads)}>
                {t("save")}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setDetails(true)}>
                {t("manage")}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => save(false, false)}>
              {t("rejectAll")}
            </Button>
            <Button type="button" variant="outline" onClick={() => save(true, true)}>
              {t("acceptAll")}
            </Button>
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Footer link that reopens the preferences. */
export function PrivacyChoicesButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PRIVACY_CHOICES))}
      className="inline-flex min-h-touch cursor-pointer items-center underline-offset-4 hover:underline sm:min-h-0 sm:py-1"
    >
      {label}
    </button>
  );
}
