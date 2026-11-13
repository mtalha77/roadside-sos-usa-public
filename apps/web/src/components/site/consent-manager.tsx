"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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

// Loaded only after analytics consent (keeps them out of the first page load entirely).
const Analytics = dynamic(() => import("@vercel/analytics/next").then((m) => m.Analytics), {
  ssr: false,
});
const ConsentDialog = dynamic(() => import("./consent-dialog"), { ssr: false });
const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false },
);

export type ConsentLabels = Record<
  | "title"
  | "body"
  | "necessary"
  | "necessaryHint"
  | "analytics"
  | "analyticsHint"
  | "ads"
  | "adsHint"
  | "gpc"
  | "acceptAll"
  | "rejectAll"
  | "save"
  | "manage"
  | "policy"
  | "saved",
  string
>;

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
export function ConsentManager({
  analyticsTags,
  labels,
}: {
  analyticsTags: boolean;
  labels: ConsentLabels;
}) {
  const t = (k: keyof ConsentLabels) => labels[k];
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const choice: ConsentChoice | null = raw === null ? null : parseConsent(raw);
  const gpc = typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [initial, setInitial] = useState({ analytics: false, ads: false });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const show = () => {
      const c = readCookie();
      setInitial({ analytics: c?.a ?? false, ads: c?.d ?? false });
      setOpenCount((n) => n + 1);
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
        <ConsentDialog
          key={openCount}
          labels={labels}
          gpc={gpc}
          initial={initial}
          startWithDetails={open}
          onSave={save}
        />
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
