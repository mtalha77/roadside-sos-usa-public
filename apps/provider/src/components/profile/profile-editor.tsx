"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Checkbox } from "@rsos/ui/checkbox";
import { inputClass } from "@rsos/ui/input";
import { Progress } from "@rsos/ui/progress";
import { Camera, Check, ShieldCheck, Star } from "lucide-react";
import { useId, useState } from "react";

const card = "rounded-2xl border bg-card p-4 sm:p-5";

/** Profile fields with a live preview and a strength meter (kept on this device in demo mode). */
export function ProfileEditor({
  company,
  rating,
  trucks,
  labels,
  payments,
  ratingLabel,
}: {
  company: string;
  rating: number | null;
  reviews: number;
  trucks: number;
  labels: Record<string, string>;
  payments: { id: string; label: string }[];
  ratingLabel: string;
}) {
  const ids = { desc: useId(), hours: useId(), trucks: useId() };
  const [photos, setPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [methods, setMethods] = useState<string[]>(["card", "cash"]);
  const [shown, setShown] = useState(trucks);
  const [saved, setSaved] = useState(false);
  const checks = [
    { ok: photos.length > 0, tip: labels.tipPhoto },
    { ok: description.trim().length >= 80, tip: labels.tipDescription },
    { ok: hours.trim().length > 0, tip: labels.tipHours },
    { ok: methods.length >= 2, tip: labels.tipPayments },
  ];
  const strength = Math.round(
    ((checks.filter((c) => c.ok).length + 1) / (checks.length + 1)) * 100,
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        onChange={() => setSaved(false)}
      >
        <section className={card} aria-labelledby="ph-h">
          <h2 id="ph-h" className="mb-3 font-semibold">
            {labels.photos}
          </h2>
          <div className="flex flex-wrap gap-2">
            {photos.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of a chosen photo
              <img
                key={u}
                src={u}
                alt={`${labels.photoAlt} ${i + 1}`}
                className="size-20 rounded-lg object-cover"
              />
            ))}
            <label className="grid size-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
              <Camera aria-hidden="true" className="size-6" />
              <span className="sr-only">{labels.addPhoto}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) =>
                  setPhotos((p) => [
                    ...p,
                    ...Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f)),
                  ])
                }
              />
            </label>
          </div>
        </section>
        <section className={card}>
          <label htmlFor={ids.desc} className="mb-2 block font-semibold">
            {labels.description}
          </label>
          <p className="mb-2 text-sm text-muted-foreground">{labels.descriptionHint}</p>
          <textarea
            id={ids.desc}
            rows={4}
            maxLength={600}
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </section>
        <section className={card}>
          <label htmlFor={ids.hours} className="mb-2 block font-semibold">
            {labels.hours}
          </label>
          <input
            id={ids.hours}
            className={inputClass}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </section>
        <fieldset className={card}>
          <legend className="px-1 font-semibold">{labels.payments}</legend>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {payments.map((p) => (
              <label key={p.id} className="flex min-h-12 items-center gap-3">
                <Checkbox
                  checked={methods.includes(p.id)}
                  onCheckedChange={(v) =>
                    setMethods((m) => (v === true ? [...m, p.id] : m.filter((x) => x !== p.id)))
                  }
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        <section className={card}>
          <label htmlFor={ids.trucks} className="mb-2 block font-semibold">
            {labels.trucksShown}
          </label>
          <input
            id={ids.trucks}
            type="number"
            min={1}
            max={Math.max(1, trucks)}
            className={inputClass}
            value={shown}
            onChange={(e) =>
              setShown(Math.min(Math.max(1, trucks), Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </section>
        <section id="documents" className={card}>
          <h2 className="font-semibold">{labels.documents}</h2>
          <p className="text-sm text-muted-foreground">{labels.documentsHint}</p>
        </section>
        {saved ? <Alert tone="success" title={labels.saved} /> : null}
        <Button type="submit" size="lg" className="self-start">
          {labels.save}
        </Button>
      </form>
      <aside className="flex flex-col gap-4" aria-label={labels.preview}>
        <section className={card} aria-labelledby="st-h">
          <h2 id="st-h" className="mb-2 font-semibold">
            {labels.strength}
          </h2>
          <Progress value={strength} label={labels.strength ?? ""} />
          <p className="mt-2 text-sm font-medium tabular-nums">{strength}%</p>
          <h3 className="mt-3 text-sm font-semibold">{labels.tips}</h3>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {checks.map((c) => (
              <li key={c.tip} className="flex gap-2">
                <Check
                  aria-hidden="true"
                  className={`size-4 shrink-0 ${c.ok ? "text-success" : "text-muted-foreground"}`}
                />
                <span className={c.ok ? "line-through text-muted-foreground" : undefined}>
                  {c.tip}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className={card} aria-labelledby="pc-h">
          <h2 id="pc-h" className="mb-3 text-sm font-medium text-muted-foreground">
            {labels.profileCard}
          </h2>
          <p className="text-lg font-semibold">{company}</p>
          <p className="flex items-center gap-1 text-sm">
            {rating !== null ? (
              <Star aria-hidden="true" className="size-4 fill-current text-warning" />
            ) : null}
            {ratingLabel}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="size-4" />
            {labels.insured} · {labels.licensed}
          </p>
          {description ? <p className="mt-2 text-sm">{description}</p> : null}
          {hours ? <p className="mt-1 text-sm text-muted-foreground">{hours}</p> : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {payments
              .filter((p) => methods.includes(p.id))
              .map((p) => p.label)
              .join(" · ")}
          </p>
        </section>
        <section className={card} aria-labelledby="qc-h">
          <h2 id="qc-h" className="mb-3 text-sm font-medium text-muted-foreground">
            {labels.quoteCard}
          </h2>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{company}</p>
              <p className="text-sm text-muted-foreground">{ratingLabel}</p>
            </div>
            <p className="text-right text-sm text-muted-foreground">{labels.eta}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}
