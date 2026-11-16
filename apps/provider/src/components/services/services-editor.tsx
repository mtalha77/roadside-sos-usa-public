"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { Checkbox } from "@rsos/ui/checkbox";
import { CurrencyInput } from "@rsos/ui/currency-input";
import { inputClass } from "@rsos/ui/input";
import { LiteMap } from "@rsos/ui/lite-map";
import { Slider } from "@rsos/ui/slider";
import { useState } from "react";

type Service = {
  slug: string;
  name: string;
  min: number;
  max: number;
  fee: number;
  rangeLabel: string;
};
type Labels = Record<
  | "prices"
  | "offer"
  | "preview"
  | "fee"
  | "outside"
  | "area"
  | "radius"
  | "miles"
  | "map"
  | "hours"
  | "always"
  | "from"
  | "to"
  | "budget"
  | "budgetHint"
  | "save"
  | "saved"
  | "fix"
  | "home",
  string
>;

const card = "rounded-2xl border bg-card p-4 sm:p-5";
const MAX_RADIUS = 60;
const MAX_BUDGET = 200;

/** Prices within the market's limits, area radius on a map, hours and a daily request budget. */
export function ServicesEditor({
  services,
  home,
  labels,
  formats,
}: {
  services: Service[];
  home: { lat: number; lng: number };
  labels: Labels;
  formats: { currency: string };
}) {
  const money = (c: number) =>
    new Intl.NumberFormat(formats.currency, { style: "currency", currency: "USD" }).format(c / 100);
  const [rows, setRows] = useState(() =>
    services.map((s) => ({
      ...s,
      on: true,
      price: (Math.round((s.min + s.max) / 2 / 500) * 500) as number | null,
    })),
  );
  const [radius, setRadius] = useState(20);
  const [always, setAlways] = useState(true);
  const [from, setFrom] = useState("07:00");
  const [to, setTo] = useState("22:00");
  const [budget, setBudget] = useState(30);
  const [saved, setSaved] = useState(false);
  const bad = rows.filter((r) => r.on && (r.price === null || r.price < r.min || r.price > r.max));
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bad.length) setSaved(true);
      }}
      onChange={() => setSaved(false)}
    >
      <section className={card} aria-labelledby="pr-h">
        <h2 id="pr-h" className="mb-3 text-lg font-semibold">
          {labels.prices}
        </h2>
        <ul className="flex flex-col divide-y">
          {rows.map((r, i) => {
            const out = r.on && (r.price === null || r.price < r.min || r.price > r.max);
            const set = (patch: Partial<(typeof rows)[number]>) =>
              setRows((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <li
                key={r.slug}
                className="grid gap-3 py-3 sm:grid-cols-[1fr_12rem_1fr] sm:items-center"
              >
                <label className="flex min-h-12 items-center gap-3 font-medium">
                  <Checkbox checked={r.on} onCheckedChange={(v) => set({ on: v === true })} />
                  <span>
                    {r.name}
                    <span className="block text-sm font-normal text-muted-foreground">
                      {r.rangeLabel}
                    </span>
                  </span>
                </label>
                <CurrencyInput
                  aria-label={`${r.name}: ${labels.offer}`}
                  aria-invalid={out || undefined}
                  disabled={!r.on}
                  value={r.price}
                  onValueChange={(v) => set({ price: v })}
                />
                <p className="text-sm text-muted-foreground">
                  {r.on && r.price !== null
                    ? `${labels.preview} ${money(r.price)} · ${labels.fee} ${money(r.fee)}`
                    : null}
                  {out ? (
                    <span className="block font-medium text-critical">{labels.outside}</span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={card} aria-labelledby="ar-h">
        <h2 id="ar-h" className="mb-3 text-lg font-semibold">
          {labels.area}
        </h2>
        <p className="mb-2 text-sm font-medium" id="radius-l">
          {labels.radius}: {radius} {labels.miles}
        </p>
        <Slider
          aria-label={labels.radius}
          min={5}
          max={MAX_RADIUS}
          step={5}
          value={[radius]}
          onValueChange={([v]) => setRadius(v ?? radius)}
        />
        <LiteMap
          className="mt-4"
          label={labels.map}
          points={[{ id: "home", ...home, kind: "provider", label: labels.home }]}
          radius={{ center: home, miles: radius }}
        />
      </section>
      <section className={card} aria-labelledby="hr-h">
        <h2 id="hr-h" className="mb-3 text-lg font-semibold">
          {labels.hours}
        </h2>
        <label className="flex min-h-12 items-center gap-3">
          <Checkbox checked={always} onCheckedChange={(v) => setAlways(v === true)} />
          {labels.always}
        </label>
        {always ? null : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              {labels.from}
              <input
                type="time"
                className={inputClass}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              {labels.to}
              <input
                type="time"
                className={inputClass}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
        )}
      </section>
      <section className={card} aria-labelledby="bd-h">
        <h2 id="bd-h" className="mb-1 text-lg font-semibold">
          {labels.budget}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{labels.budgetHint}</p>
        <input
          type="number"
          aria-labelledby="bd-h"
          min={1}
          max={MAX_BUDGET}
          className={inputClass}
          value={budget}
          onChange={(e) =>
            setBudget(Math.min(MAX_BUDGET, Math.max(1, Number(e.target.value) || 1)))
          }
        />
      </section>
      {bad.length ? <Alert tone="warning" title={labels.fix} /> : null}
      {saved ? <Alert tone="success" title={labels.saved} /> : null}
      <Button type="submit" size="lg" className="self-start">
        {labels.save}
      </Button>
    </form>
  );
}
