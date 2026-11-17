"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { type MarketStatusState, setMarketStatusAction } from "@/lib/market-actions";

const STATUSES = ["draft", "test", "active", "paused"] as const;

/** Market status, with "live" blocked until the checklist is green (super admin override). */
export function MarketStatusForm({
  marketId,
  status,
  ready,
  canOverride,
  canChange,
}: {
  marketId: string;
  status: string;
  ready: boolean;
  canOverride: boolean;
  canChange: boolean;
}) {
  const t = useTranslations("admin.markets");
  const [next, setNext] = useState(status);
  const [state, action, pending] = useActionState<MarketStatusState, FormData>(
    setMarketStatusAction,
    {},
  );
  if (!canChange) return null;
  const needsOverride = next === "active" && !ready;
  const field = "flex flex-col gap-1 text-sm font-medium";
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="market" value={marketId} />
      <label className={field}>
        {t("statusLabel")}
        <select
          name="status"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="min-h-touch rounded-lg border bg-background px-3"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </label>
      {needsOverride ? (
        canOverride ? (
          <label className={field}>
            {t("overrideReason")}
            <textarea
              name="reason"
              required
              minLength={5}
              maxLength={500}
              rows={2}
              className="rounded-lg border bg-background px-3 py-2"
            />
          </label>
        ) : (
          <p className="text-sm font-medium text-warning-strong">{t("notReady")}</p>
        )
      ) : null}
      <Button
        type="submit"
        size="sm"
        className="self-start"
        loading={pending}
        disabled={next === status || (needsOverride && !canOverride)}
      >
        {t("saveStatus")}
      </Button>
      {state.error ? <Alert tone="critical" title={t(`statusErrors.${state.error}`)} /> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("statusSaved")}
        </p>
      ) : null}
    </form>
  );
}
