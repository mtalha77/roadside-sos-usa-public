"use client";

import type { BookingMode } from "@rsos/core/demo";
import { useState } from "react";

/**
 * Instant book (RSOS-109): compare quotes (default), or let us book the first verified provider
 * at or below the price the customer sets (pre-filled with the market's typical price). The
 * customer can switch at any time until a provider is booked.
 */
export function BookingChoice({
  mode,
  maxCents,
  onChange,
  labels,
  money,
}: {
  mode: BookingMode;
  maxCents: number;
  onChange: (mode: BookingMode, maxCents: number) => void;
  labels: Record<
    "title" | "compare" | "compareHint" | "instant" | "instantHint" | "max" | "apply" | "on",
    string
  >;
  money: (cents: number) => string;
}) {
  const [dollars, setDollars] = useState(String(Math.round(maxCents / 100)));
  const cents = Math.max(5, Math.min(10_000, Math.round(Number(dollars) || 0))) * 100;
  const option =
    "flex min-h-touch cursor-pointer gap-3 rounded-xl border-2 p-3 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:outline-2 has-focus-visible:outline-ring";
  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <legend className="sr-only">{labels.title}</legend>
      <p className="font-semibold" aria-hidden="true">
        {labels.title}
      </p>
      <label className={option}>
        <input
          type="radio"
          name="booking-mode"
          checked={mode === "compare"}
          onChange={() => onChange("compare", maxCents)}
          className="mt-1 size-5 accent-[var(--primary)]"
        />
        <span className="flex flex-col">
          <span className="font-medium">{labels.compare}</span>
          <span className="text-sm text-muted-foreground">{labels.compareHint}</span>
        </span>
      </label>
      <label className={option}>
        <input
          type="radio"
          name="booking-mode"
          checked={mode === "instant"}
          onChange={() => onChange("instant", cents)}
          className="mt-1 size-5 accent-[var(--primary)]"
        />
        <span className="flex flex-col">
          <span className="font-medium">{labels.instant}</span>
          <span className="text-sm text-muted-foreground">{labels.instantHint}</span>
        </span>
      </label>
      {mode === "instant" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onChange("instant", cents);
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            {labels.max}
            <span className="flex items-center gap-1">
              <span aria-hidden="true">$</span>
              <input
                inputMode="numeric"
                value={dollars}
                onChange={(e) => setDollars(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
                className="min-h-touch w-28 rounded-lg border border-input bg-surface px-3 text-right tabular-nums"
              />
            </span>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-touch items-center rounded-lg border px-4 font-medium hover:bg-accent"
          >
            {labels.apply}
          </button>
          <p role="status" className="w-full text-sm font-medium">
            {labels.on.replace("{price}", money(maxCents))}
          </p>
        </form>
      ) : null}
    </fieldset>
  );
}
