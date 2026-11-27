"use client";

import type { EconomicsInputs } from "@rsos/core/economics";
import { Button } from "@rsos/ui/button";
import { useActionState } from "react";
import { type EconomicsState, saveEconomicsAction } from "@/lib/economics-actions";

const input =
  "min-h-12 w-full rounded-lg border border-input bg-background px-3 text-right tabular-nums";

/** One market and scenario: the brief's inputs, then the funnel assumptions (RSOS-113). */
export function EconomicsForm({
  marketId,
  scenario,
  inputs,
  services,
  labels,
}: {
  marketId: string;
  scenario: string;
  inputs: EconomicsInputs | null;
  /** Service slug to its name, in menu order. */
  services: [string, string][];
  labels: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<EconomicsState, FormData>(
    saveEconomicsAction,
    {},
  );
  const p = (v: number | undefined) => (v === undefined ? "" : String(Math.round(v * 10000) / 100));
  const field = (name: string, label: string, value: string, unit: string, required = true) => (
    <label className="flex flex-col gap-1 text-sm font-medium">
      <span>
        {label} <span className="font-normal text-muted-foreground">({unit})</span>
      </span>
      <input
        name={name}
        defaultValue={value}
        inputMode="decimal"
        required={required}
        className={input}
      />
    </label>
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="marketId" value={marketId} />
      <input type="hidden" name="scenario" value={scenario} />
      <input type="hidden" name="services" value={services.map(([s]) => s).join(",")} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {field("monthlyBudget", labels.budget!, String(inputs?.monthlyBudget ?? ""), labels.usd!)}
        {field("costPerClick", labels.cpc!, String(inputs?.costPerClick ?? ""), labels.usd!)}
        {field("clickToRequest", labels.clickToRequest!, p(inputs?.clickToRequest), "%")}
        {field("acceptance", labels.acceptance!, p(inputs?.acceptance), "%")}
        {field("paymentFeeShare", labels.paymentFees!, p(inputs?.paymentFeeShare), "%")}
        {field(
          "subscriptionsNet",
          labels.subscriptions!,
          String(inputs?.subscriptionsNet ?? ""),
          labels.usdMonth!,
        )}
        {field("fixedCosts", labels.fixed!, String(inputs?.fixedCosts ?? ""), labels.usdMonth!)}
        {/* RSOS-115: optional (empty means no signup bonus in the model). */}
        {field(
          "signupBonus",
          labels.signupBonus!,
          String(inputs?.signupBonus ?? ""),
          labels.usd!,
          false,
        )}
        {field(
          "newProviders",
          labels.newProviders!,
          String(inputs?.newProvidersPerMonth ?? ""),
          labels.perMonth!,
          false,
        )}
        {/* RSOS-117: optional; empty while the customer booking fee is off. */}
        {field(
          "bookingFee",
          labels.bookingFee!,
          String(inputs?.bookingFee ?? ""),
          labels.usd!,
          false,
        )}
        {field("bookingFeeShare", labels.bookingFeeShare!, p(inputs?.bookingFeeShare), "%", false)}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{labels.mixAndFees}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(([slug, name]) => (
            <div key={slug} className="grid grid-cols-[1fr_6rem_6rem] items-end gap-2">
              <span className="pb-3 text-sm">{name}</span>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {labels.mix}
                <input
                  name={`mix.${slug}`}
                  defaultValue={p(inputs?.serviceMix[slug] ?? 0)}
                  inputMode="decimal"
                  className={input}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                {labels.fee}
                <input
                  name={`fee.${slug}`}
                  defaultValue={String(inputs?.feeByService[slug] ?? 0)}
                  inputMode="decimal"
                  className={input}
                />
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{labels.assumptions}</legend>
        <p className="text-sm text-muted-foreground">{labels.assumptionsHint}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {field("startToSubmit", labels.startToSubmit!, p(inputs?.startToSubmit), "%")}
          {field("quoteRate", labels.quoteRate!, p(inputs?.quoteRate), "%")}
          {field("completionRate", labels.completionRate!, p(inputs?.completionRate), "%")}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {labels.save}
        </Button>
        {state.ok ? (
          <p role="status" className="text-sm font-medium text-success-strong">
            {labels.saved}
          </p>
        ) : state.error ? (
          <p role="alert" className="text-sm font-medium text-critical-strong">
            {labels[`error.${state.error}`] ?? labels["error.invalid"]}
          </p>
        ) : null}
      </div>
    </form>
  );
}
