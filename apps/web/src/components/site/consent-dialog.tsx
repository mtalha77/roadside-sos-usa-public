"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { ConsentLabels } from "./consent-manager";
import { LightButton, LightSwitch } from "./light-controls";

/** The banner and preferences UI; loaded only when it has to be shown. */
export default function ConsentDialog({
  labels,
  gpc,
  initial,
  startWithDetails,
  onSave,
}: {
  labels: ConsentLabels;
  gpc: boolean;
  initial: { analytics: boolean; ads: boolean };
  startWithDetails: boolean;
  onSave: (analytics: boolean, ads: boolean) => void;
}) {
  const t = (k: keyof ConsentLabels) => labels[k];
  const id = useId();
  const [details, setDetails] = useState(startWithDetails);
  const [analytics, setAnalytics] = useState(initial.analytics);
  const [ads, setAds] = useState(initial.ads);
  const save = onSave;
  return (
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
            <LightSwitch checked disabled readOnly aria-label={t("necessary")} />
          </li>
          <li className="flex items-center justify-between gap-4">
            <span>
              <span className="font-medium">{t("analytics")}</span>
              <span className="block text-sm text-muted-foreground">{t("analyticsHint")}</span>
            </span>
            <LightSwitch
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              aria-label={t("analytics")}
            />
          </li>
          <li className="flex items-center justify-between gap-4">
            <span>
              <span className="font-medium">{t("ads")}</span>
              <span className="block text-sm text-muted-foreground">{t("adsHint")}</span>
            </span>
            <LightSwitch
              checked={ads && !gpc}
              disabled={gpc}
              onChange={(e) => setAds(e.target.checked)}
              aria-label={t("ads")}
            />
          </li>
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {details ? (
          <LightButton onClick={() => save(analytics, ads)}>{t("save")}</LightButton>
        ) : (
          <LightButton onClick={() => setDetails(true)}>{t("manage")}</LightButton>
        )}
        <LightButton onClick={() => save(false, false)}>{t("rejectAll")}</LightButton>
        <LightButton onClick={() => save(true, true)}>{t("acceptAll")}</LightButton>
      </div>
    </section>
  );
}
