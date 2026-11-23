"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { CurrencyInput } from "@rsos/ui/currency-input";
import { inputClass } from "@rsos/ui/input";
import { useId, useState } from "react";

type Pending = {
  service: string;
  min: number;
  max: number;
  fee: number;
  effective: string;
  approved: boolean;
};

/**
 * Schedule a price change with an effective date; a super admin approves it. Kept on this page
 * until writes to market_services are wired in the backend batch.
 */
export function PriceChange({
  market,
  services,
  canApprove,
  labels: l,
}: {
  market: string;
  services: { id: string; name: string }[];
  canApprove: boolean;
  labels: Record<string, string>;
}) {
  const id = useId();
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  return (
    <details className="rounded-2xl border bg-card p-4">
      <summary className="flex min-h-12 cursor-pointer items-center font-medium">
        {l.schedule} · {market}
      </summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const effective = String(f.get("effective") ?? "");
          if (min === null || max === null || fee === null || min > max || !effective) {
            setError(true);
            return;
          }
          setError(false);
          const svc = services.find((s) => s.id === f.get("service"))?.name ?? "";
          setPending((p) => [...p, { service: svc, min, max, fee, effective, approved: false }]);
        }}
      >
        <label className="flex flex-col gap-2 text-sm font-medium">
          {l.service}
          <select name="service" className={inputClass}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {l.min}
          <CurrencyInput value={min} onValueChange={setMin} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {l.max}
          <CurrencyInput value={max} onValueChange={setMax} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          {l.fee}
          <CurrencyInput value={fee} onValueChange={setFee} />
        </label>
        <label htmlFor={`${id}-d`} className="flex flex-col gap-2 text-sm font-medium">
          {l.effective}
          <input id={`${id}-d`} name="effective" type="date" className={inputClass} />
        </label>
        <Button type="submit" className="self-end">
          {l.submit}
        </Button>
        {error ? (
          <Alert tone="critical" title={l.invalid} className="sm:col-span-2 lg:col-span-5" />
        ) : null}
      </form>
      {pending.length ? (
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          {pending.map((p, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
            >
              <span>
                {p.service}: {money(p.min)} {l.to} {money(p.max)} · {l.fee} {money(p.fee)} ·{" "}
                {p.effective}
              </span>
              {p.approved ? (
                <span className="font-medium text-success-strong">{l.approved}</span>
              ) : canApprove ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    setPending((all) => all.map((x, j) => (j === i ? { ...x, approved: true } : x)))
                  }
                >
                  {l.approve}
                </Button>
              ) : (
                <span className="text-muted-foreground">{l.needsApproval}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
