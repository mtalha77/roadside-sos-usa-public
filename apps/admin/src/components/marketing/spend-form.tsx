"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { saveSpendAction, type SpendState } from "@/lib/marketing-actions";

const CHANNELS = ["google_ads", "meta", "bing", "gmb", "other"] as const;

/** Daily ad spend per market and channel (manual until the ad platform APIs are connected). */
export function SpendForm({
  markets,
  today,
  inputClass,
}: {
  markets: { value: string; label: string }[];
  today: string;
  inputClass: string;
}) {
  const t = useTranslations("admin.marketing");
  const [state, action, pending] = useActionState<SpendState, FormData>(saveSpendAction, {});
  const label = "flex flex-col gap-1 text-sm font-medium";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        {t("day")}
        <input type="date" name="day" required defaultValue={today} className={inputClass} />
      </label>
      <label className={label}>
        {t("cols.market")}
        <select name="market" required className={inputClass}>
          {markets.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("channel")}
        <select name="channel" required className={inputClass}>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t(`channels.${c}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("amount")}
        <input name="amount" inputMode="decimal" required className={inputClass} />
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Button type="submit" size="sm" className="self-start" loading={pending}>
          {t("saveSpend")}
        </Button>
        {state.error ? <Alert tone="critical" title={t(`errors.${state.error}`)} /> : null}
        {state.ok ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("saved")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
