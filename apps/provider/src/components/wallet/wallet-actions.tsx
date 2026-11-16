"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { CurrencyInput } from "@rsos/ui/currency-input";
import { Dialog, DialogContent, DialogTrigger } from "@rsos/ui/dialog";
import { RadioCards } from "@rsos/ui/radio-cards";
import { Switch } from "@rsos/ui/switch";
import { useId, useState } from "react";

type Labels = {
  topUp: string;
  topUpTitle: string;
  custom: string;
  stripe: string;
  continue: string;
  close: string;
  auto: string;
  autoHint: string;
  below: string;
  amount: string;
  saved: string;
  presetLabels: string[];
};

/**
 * Top-up sheet and auto-recharge settings (RSOS-057). Card payments need Stripe keys, so the
 * payment step is a placeholder; settings are kept on this device until billing is wired.
 */
export function WalletActions({ presets, labels }: { presets: number[]; labels: Labels }) {
  const [choice, setChoice] = useState(String(presets[1] ?? presets[0]));
  const [custom, setCustom] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [below, setBelow] = useState<number | null>(5000);
  const [amount, setAmount] = useState<number | null>(25000);
  const [saved, setSaved] = useState(false);
  const autoId = useId();
  return (
    <div className="mt-4 flex flex-col gap-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button size="lg" className="w-full sm:w-auto">
            {labels.topUp}
          </Button>
        </DialogTrigger>
        <DialogContent title={labels.topUpTitle} closeLabel={labels.close}>
          <RadioCards
            aria-label={labels.topUpTitle}
            value={choice}
            onValueChange={setChoice}
            options={[
              ...presets.map((c, i) => ({ value: String(c), title: labels.presetLabels[i] })),
              { value: "custom", title: labels.custom },
            ]}
          />
          {choice === "custom" ? (
            <CurrencyInput aria-label={labels.custom} value={custom} onValueChange={setCustom} />
          ) : null}
          <Alert tone="info" title={labels.stripe} />
          <Button disabled>{labels.continue}</Button>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={autoId} className="font-medium">
            {labels.auto}
            <span className="block text-sm font-normal text-muted-foreground">
              {labels.autoHint}
            </span>
          </label>
          <Switch
            id={autoId}
            checked={auto}
            onCheckedChange={(v) => {
              setAuto(v);
              setSaved(true);
            }}
          />
        </div>
        {auto ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              {labels.below}
              <CurrencyInput value={below} onValueChange={setBelow} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              {labels.amount}
              <CurrencyInput value={amount} onValueChange={setAmount} />
            </label>
          </div>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-muted-foreground">
            {labels.saved}
          </p>
        ) : null}
      </div>
    </div>
  );
}
