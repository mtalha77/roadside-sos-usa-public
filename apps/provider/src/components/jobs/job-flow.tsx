"use client";

import { canMarkArrived, codeAttempt, demoCompletionCode } from "@rsos/core/booking";
import { demoMaskedNumber } from "@rsos/config/demo-fixtures";
import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { Stepper } from "@rsos/ui/stepper";
import { Camera, MessageSquare, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { jobStepAction, type JobStepResult } from "@/lib/job-actions";

/** The provider's 4 taps (RSOS-117): Accept (done), On my way, Arrived, Done with the code. */
const STEPS = ["accepted", "on_my_way", "arrived", "done"] as const;
type Point = { lat: number; lng: number };
type Labels = { team: string[] };

/**
 * Active job (RSOS-055, simplified in RSOS-117): one large button for the next step. "Arrived"
 * is set by itself when the phone is within about 200 m of the customer (manual tap only inside
 * that range). "Done" takes the customer's 4-digit code; if the customer is not there, "Customer
 * not available" asks for 2 photos instead. Photos are optional otherwise. Real bookings run
 * through the database; demo jobs keep progress on this device and use a demo code and location.
 */
export function JobFlow({
  jobId,
  bookingId = null,
  lat,
  lng,
  address,
  team,
}: {
  jobId: string;
  bookingId?: string | null;
  lat: number;
  lng: number;
  address: string;
} & Labels) {
  const t = useTranslations("portal.active");
  const key = `rsos_job_${jobId}`;
  const demo = bookingId === null;
  const customer: Point = { lat, lng };
  const demoCode = demoCompletionCode(jobId);
  const [step, setStep] = useState(1);
  const [here, setHere] = useState<Point | null>(null);
  const [gps, setGps] = useState<"idle" | "watching" | "denied">("idle");
  const [code, setCode] = useState("");
  const [tries, setTries] = useState(0);
  const [message, setMessage] = useState<{ tone: "critical" | "info"; text: string } | null>(null);
  const [notThere, setNotThere] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(key) ?? "0");
    if (saved) queueMicrotask(() => setStep(saved));
  }, [key]);
  const save = (n: number) => {
    setStep(n);
    try {
      localStorage.setItem(key, String(n));
    } catch {
      /* private mode */
    }
  };

  // While on the way, share the location for this job only and watch for arrival.
  useEffect(() => {
    if (step !== 2 || typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGps("watching");
      },
      () => setGps("denied"),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [step]);

  const near = canMarkArrived(here, customer);
  const run = async (
    s: "on_my_way" | "arrived" | "done" | "not_available" | "cancel",
    extra: { code?: string; photos?: number } = {},
  ): Promise<JobStepResult> => {
    if (demo) return "done";
    setBusy(true);
    const r = await jobStepAction({
      bookingId: bookingId!,
      step: s,
      lat: here?.lat ?? null,
      lng: here?.lng ?? null,
      code: extra.code ?? null,
      photos: extra.photos ?? 0,
      device: null,
    });
    setBusy(false);
    return r;
  };

  const arrive = async () => {
    if (!near) return setMessage({ tone: "info", text: t("tooFar") });
    const r = await run("arrived");
    if (r === "too_far") return setMessage({ tone: "info", text: t("tooFar") });
    if (r === "error") return setMessage({ tone: "critical", text: t("error") });
    setMessage(null);
    save(3);
  };
  // Arrival is automatic once inside the range.
  useEffect(() => {
    if (step === 2 && near && !busy) queueMicrotask(() => void arrive());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the position changes
  }, [near, step]);

  const finish = async () => {
    if (demo) {
      const a = codeAttempt(demoCode, code, tries);
      setTries(a.tries);
      if (a.result !== "ok")
        return setMessage({
          tone: "critical",
          text: a.result === "locked" ? t("codeLocked") : t("codeWrong"),
        });
    } else {
      const r = await run("done", { code });
      if (r === "wrong_code") return setMessage({ tone: "critical", text: t("codeWrong") });
      if (r === "locked") return setMessage({ tone: "critical", text: t("codeLocked") });
      if (r === "error") return setMessage({ tone: "critical", text: t("error") });
    }
    setMessage(null);
    save(4);
  };
  const finishNotThere = async () => {
    if (photos.length < 2) return setMessage({ tone: "info", text: t("needPhotos") });
    const r = await run("not_available", { photos: photos.length });
    if (r === "error") return setMessage({ tone: "critical", text: t("error") });
    setMessage(null);
    save(4);
  };

  const done = step >= STEPS.length;
  if (cancelled) return <Alert tone="info" title={t("cancelled")} />;
  const dest = `${lat},${lng}`;
  return (
    <div className="flex flex-col gap-5">
      <Stepper
        label={t("title")}
        current={Math.min(step, STEPS.length - 1)}
        steps={STEPS.map((s) => t(`steps.${s}`))}
      />
      <p>{t("addressLine", { address })}</p>
      {message ? <Alert tone={message.tone} title={message.text} /> : null}

      {done ? (
        <Alert tone="success" title={t("done")} />
      ) : step === 1 ? (
        <Button
          type="button"
          size="lg"
          className="min-h-16 text-lg"
          disabled={busy}
          onClick={async () => {
            const r = await run("on_my_way");
            if (r === "error") return setMessage({ tone: "critical", text: t("error") });
            save(2);
          }}
        >
          {t("steps.on_my_way")}
        </Button>
      ) : step === 2 ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            className="min-h-16 text-lg"
            disabled={!near || busy}
            onClick={() => void arrive()}
          >
            {t("steps.arrived")}
          </Button>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {gps === "denied" ? t("gpsDenied") : near ? t("gpsNear") : t("gpsAuto")}
          </p>
          {demo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setHere(customer)}
            >
              {t("demoArrive")}
            </Button>
          ) : null}
        </div>
      ) : notThere ? (
        <section className="flex flex-col gap-3" aria-labelledby="nt-h">
          <h2 id="nt-h" className="font-semibold">
            {t("notThereTitle")}
          </h2>
          <p className="text-sm">{t("notThereBody")}</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((u, i) => (
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
                onChange={(e) =>
                  setPhotos((p) => [
                    ...p,
                    ...[...(e.target.files ?? [])].slice(0, 4).map((f) => URL.createObjectURL(f)),
                  ])
                }
              />
            </label>
          </div>
          <Button type="button" size="lg" disabled={busy} onClick={() => void finishNotThere()}>
            {t("notThereDone")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            onClick={() => setNotThere(false)}
          >
            {t("backToCode")}
          </Button>
        </section>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void finish();
          }}
        >
          <label className="flex flex-col gap-2 text-lg font-medium">
            {t("codeLabel")}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className={`${inputClass} max-w-40 text-center font-mono text-3xl tracking-[0.4em]`}
            />
          </label>
          {demo ? (
            <p className="text-sm text-muted-foreground">{t("demoCode", { code: demoCode })}</p>
          ) : null}
          <Button type="submit" size="lg" className="min-h-16 text-lg" disabled={busy}>
            {t("steps.done")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            onClick={() => setNotThere(true)}
          >
            {t("notThere")}
          </Button>
        </form>
      )}

      {step <= 2 ? (
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
      {team.length > 1 ? (
        <label className="flex flex-col gap-2 text-sm font-medium">
          {t("assign")}
          <select className="min-h-touch rounded-lg border border-input bg-surface px-3">
            {team.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      ) : null}
      {done ? null : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run("cancel");
            if (r === "error") return setMessage({ tone: "critical", text: t("error") });
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
            {(["vehicle_not_found", "unsafe", "equipment"] as const).map((r) => (
              <option key={r} value={r}>
                {t(`cancelReasons.${r}`)}
              </option>
            ))}
          </select>
          <Button type="submit" variant="ghost">
            {t("cancel")}
          </Button>
        </form>
      )}
    </div>
  );
}
