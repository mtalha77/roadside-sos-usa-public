"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { Progress } from "@rsos/ui/progress";
import { Stepper } from "@rsos/ui/stepper";
import { CircleCheck } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

type Service = { slug: string; name: string; min: number; max: number; range: string };
type Values = Record<string, string>;
const KEY = "rsos_onboarding";
const card = "rounded-2xl border bg-card p-4 sm:p-5";

/** Nine short steps; each "Next" saves progress on this device so the wizard can be resumed. */
export function OnboardingWizard({
  company,
  services,
  presets,
  steps,
  fields: f,
  labels: l,
}: {
  company: string;
  services: Service[];
  presets: { cents: number; label: string }[];
  steps: { id: string; label: string }[];
  fields: Record<string, string>;
  labels: Record<string, string>;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({ legalName: company, radius: "20", trucks: "1" });
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
        step: number;
        values: Values;
        done?: boolean;
      } | null;
      if (saved)
        queueMicrotask(() => {
          setStep(saved.step);
          setValues((v) => ({ ...v, ...saved.values }));
          setDone(Boolean(saved.done));
        });
    } catch {
      // Unreadable saved progress: start over.
    }
  }, []);
  const persist = (next: { step: number; values: Values; done?: boolean }) =>
    localStorage.setItem(KEY, JSON.stringify(next));
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));
  const id = steps[step]?.id;
  const field = (name: string, input: ReactNode, hint?: string) => (
    <label key={name} className="flex flex-col gap-2 text-sm font-medium">
      {f[name]}
      {input}
      {hint ? <span className="font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
  const text = (name: string, props: Record<string, unknown> = {}) =>
    field(
      name,
      <input
        name={name}
        className={inputClass}
        value={values[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
        {...props}
      />,
    );
  if (done)
    return (
      <section className={`${card} flex flex-col gap-4`} aria-labelledby="next-h">
        <CircleCheck aria-hidden="true" className="size-10 text-success" />
        <h2 id="next-h" className="text-xl font-semibold">
          {l.nextTitle}
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>{l.next1}</li>
          <li>{l.next2}</li>
          <li>{l.next3}</li>
        </ol>
        <Alert tone="info" title={l.review} />
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            setDone(false);
            setStep(0);
            persist({ step: 0, values });
          }}
        >
          {l.edit}
        </Button>
      </section>
    );
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!e.currentTarget.checkValidity()) {
          setError(true);
          e.currentTarget.reportValidity();
          return;
        }
        setError(false);
        if (step === steps.length - 1) {
          setDone(true);
          persist({ step, values, done: true });
          return;
        }
        setStep(step + 1);
        persist({ step: step + 1, values });
        heading.current?.focus();
      }}
    >
      <div className="hidden lg:block">
        <Stepper steps={steps.map((s) => s.label)} current={step} label={l.progress!} />
      </div>
      <div className="lg:hidden">
        <Progress value={Math.round((step / steps.length) * 100)} label={l.progress!} />
      </div>
      <section className={`${card} flex flex-col gap-4`}>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
          {steps[step]?.label}
          <span className="block text-sm font-normal text-muted-foreground">
            {l.stepOf?.replace("{n}", String(step + 1)).replace("{total}", String(steps.length))}
          </span>
        </h2>
        {id === "account" ? (
          <>
            {text("name", { required: true, autoComplete: "name" })}
            {text("phone", { required: true, type: "tel", autoComplete: "tel" })}
          </>
        ) : null}
        {id === "company" ? (
          <>
            {text("legalName", { required: true, autoComplete: "organization" })}
            {text("dot", { inputMode: "numeric" })}
            {text("years", { type: "number", min: 0, max: 80, inputMode: "numeric" })}
          </>
        ) : null}
        {id === "services"
          ? services.map((s) => {
              const v = Number(values[`price_${s.slug}`] ?? "");
              const out = values[`price_${s.slug}`] && (v < s.min || v > s.max);
              return field(
                `price_${s.slug}`,
                <input
                  name={`price_${s.slug}`}
                  type="number"
                  inputMode="decimal"
                  min={s.min}
                  max={s.max}
                  aria-label={s.name}
                  aria-invalid={out || undefined}
                  className={inputClass}
                  value={values[`price_${s.slug}`] ?? ""}
                  onChange={(e) => set(`price_${s.slug}`, e.target.value)}
                />,
                out ? `${s.range} · ${l.outside}` : s.range,
              );
            })
          : null}
        {id === "area"
          ? field(
              "radius",
              <select
                name="radius"
                className={inputClass}
                value={values.radius}
                onChange={(e) => set("radius", e.target.value)}
              >
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} {l.miles}
                  </option>
                ))}
              </select>,
            )
          : null}
        {id === "trucks" ? (
          <>
            {text("trucks", { type: "number", min: 1, max: 50, required: true })}
            {text("operators", { type: "number", min: 0, max: 100 })}
          </>
        ) : null}
        {id === "documents" ? (
          <>
            {field(
              "insurance",
              <input
                name="insurance"
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className={inputClass}
                onChange={(e) => set("insurance", e.target.files?.[0]?.name ?? "")}
              />,
              values.insurance || undefined,
            )}
            {text("insuranceExpiry", { type: "date" })}
            {field(
              "license",
              <input
                name="license"
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className={inputClass}
                onChange={(e) =>
                  set("license", e.target.value ? (e.target.files?.[0]?.name ?? "") : "")
                }
              />,
              values.license || undefined,
            )}
            {text("licenseExpiry", { type: "date" })}
          </>
        ) : null}
        {id === "profile"
          ? field(
              "description",
              <textarea
                name="description"
                rows={4}
                maxLength={600}
                className={inputClass}
                value={values.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />,
            )
          : null}
        {id === "wallet" ? (
          <>
            {field(
              "topUp",
              <select
                name="topUp"
                className={inputClass}
                value={values.topUp ?? String(presets[0]?.cents ?? "")}
                onChange={(e) => set("topUp", e.target.value)}
              >
                {presets.map((p) => (
                  <option key={p.cents} value={p.cents}>
                    {p.label}
                  </option>
                ))}
              </select>,
            )}
            <Alert tone="info" title={l.stripe} />
          </>
        ) : null}
        {id === "agreements" ? (
          <>
            {(["terms", "fees"] as const).map((k) => (
              <label key={k} className="flex min-h-12 items-start gap-3">
                <input
                  type="checkbox"
                  name={k}
                  required
                  className="mt-1 size-5"
                  checked={values[k] === "1"}
                  onChange={(e) => set(k, e.target.checked ? "1" : "")}
                />
                {f[k]}
              </label>
            ))}
          </>
        ) : null}
        {error ? <Alert tone="critical" title={l.required} /> : null}
      </section>
      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => {
            setStep(step - 1);
            persist({ step: step - 1, values });
          }}
        >
          {l.back}
        </Button>
        <Button type="submit" size="lg">
          {step === steps.length - 1 ? l.submit : l.next}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{l.saved}</p>
    </form>
  );
}
