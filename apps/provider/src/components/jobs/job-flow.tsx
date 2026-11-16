"use client";

import { demoMaskedNumber } from "@rsos/config/demo-fixtures";
import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Stepper } from "@rsos/ui/stepper";
import { Camera, MessageSquare, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const STEPS = ["start", "arrived", "working", "completed"] as const;
type Labels = { team: string[] };

/**
 * Active job (RSOS-055): one large button for the next step, navigation deep links, masked call
 * and text, before and after photos, report an issue, cancel with a reason, assign to an operator.
 * Progress is kept on this device in demo mode.
 */
export function JobFlow({
  jobId,
  lat,
  lng,
  address,
  team,
}: { jobId: string; lat: number; lng: number; address: string } & Labels) {
  const t = useTranslations("portal.active");
  const key = `rsos_job_${jobId}`;
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<{ before: string[]; after: string[] }>({
    before: [],
    after: [],
  });
  const [cancelled, setCancelled] = useState(false);
  const [issue, setIssue] = useState(false);
  useEffect(() => {
    const saved = Number(localStorage.getItem(key) ?? "0");
    if (saved) queueMicrotask(() => setStep(saved));
  }, [key]);
  const advance = () => {
    const next = Math.min(STEPS.length, step + 1);
    setStep(next);
    localStorage.setItem(key, String(next));
  };
  const add = (which: "before" | "after", files: FileList | null) => {
    if (!files) return;
    const urls = [...files].slice(0, 4).map((f) => URL.createObjectURL(f));
    setPhotos((p) => ({ ...p, [which]: [...p[which], ...urls] }));
  };
  const done = step >= STEPS.length;
  if (cancelled) return <Alert tone="info" title={t("cancel")} />;
  const dest = `${lat},${lng}`;
  return (
    <div className="flex flex-col gap-5">
      <Stepper
        label={t("title")}
        current={Math.min(step, STEPS.length - 1)}
        steps={STEPS.map((s) => t(`steps.${s}`))}
      />
      <p>{t("addressLine", { address })}</p>
      {done ? (
        <Alert tone="success" title={t("done")} />
      ) : (
        <Button type="button" size="lg" className="min-h-16 text-lg" onClick={advance}>
          {t(`steps.${STEPS[step]!}`)}
        </Button>
      )}
      {step <= 1 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("navigate")}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("maps.google")}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`https://maps.apple.com/?daddr=${dest}`} target="_blank" rel="noreferrer">
                {t("maps.apple")}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://waze.com/ul?ll=${dest}&navigate=yes`}
                target="_blank"
                rel="noreferrer"
              >
                {t("maps.waze")}
              </a>
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={`tel:${demoMaskedNumber}`}>
            <Phone aria-hidden="true" />
            {t("call")}
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`sms:${demoMaskedNumber}`}>
            <MessageSquare aria-hidden="true" />
            {t("text")}
          </a>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("masked")}</p>
      {(["before", "after"] as const).map((which) => (
        <section key={which} className="flex flex-col gap-2">
          <h2 className="font-semibold">
            {which === "before" ? t("photosBefore") : t("photosAfter")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {photos[which].map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of a photo just taken
              <img
                key={u}
                src={u}
                alt={t("photoAlt", { n: i + 1 })}
                className="size-20 rounded-lg object-cover"
              />
            ))}
            <label className="grid size-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed text-muted-foreground">
              <Camera aria-hidden="true" className="size-6" />
              <span className="sr-only">{t("addPhoto")}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={(e) => add(which, e.target.files)}
              />
            </label>
          </div>
        </section>
      ))}
      <label className="flex flex-col gap-2 text-sm font-medium">
        {t("assign")}
        <select className="min-h-touch rounded-lg border border-input bg-surface px-3">
          {team.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      {issue ? <Alert tone="info" title={t("issue")} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={() => setIssue(true)}>
          {t("issue")}
        </Button>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCancelled(true);
          }}
        >
          <label htmlFor="cancel-reason" className="sr-only">
            {t("cancelReason")}
          </label>
          <select
            id="cancel-reason"
            className="min-h-touch rounded-lg border border-input bg-surface px-3"
          >
            {(["driver_no_show", "vehicle_not_found", "unsafe", "equipment"] as const).map((r) => (
              <option key={r} value={r}>
                {t(`cancelReasons.${r}`)}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            {t("cancel")}
          </Button>
        </form>
      </div>
    </div>
  );
}
