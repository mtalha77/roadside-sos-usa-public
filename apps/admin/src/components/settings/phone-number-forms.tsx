"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { addNumberAction, type PhoneActionState, syncNumbersAction } from "@/lib/phone-actions";

type Option = { value: string; label: string };

export function AddNumberForm({
  markets,
  sources,
  inputClass,
}: {
  markets: Option[];
  sources: Option[];
  inputClass: string;
}) {
  const t = useTranslations("admin.settings.phones");
  const [state, action, pending] = useActionState<PhoneActionState, FormData>(addNumberAction, {});
  const label = "flex flex-col gap-1 text-sm font-medium";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" noValidate>
      {state.error ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <Alert tone="critical" title={t(`errors.${state.error}`)} />
        </div>
      ) : state.ok ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <Alert tone="success" title={t("added", { phone: state.ok })} />
        </div>
      ) : null}
      <label className={label}>
        {t("number")}
        <input name="phone" type="tel" inputMode="tel" required className={inputClass} />
      </label>
      <label className={label}>
        {t("market")}
        <select name="market" required className={inputClass}>
          {markets.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("source")}
        <select name="source" required className={inputClass} defaultValue="website">
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("label")}
        <input name="label" maxLength={80} className={inputClass} />
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit" loading={pending}>
          {t("addButton")}
        </Button>
      </div>
    </form>
  );
}

export function SyncNumbersButton() {
  const t = useTranslations("admin.settings.phones");
  const [state, action, pending] = useActionState<PhoneActionState>(syncNumbersAction, {});
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <Button type="submit" variant="outline" size="sm" loading={pending}>
        {t("sync")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-critical-strong">
          {t(`errors.${state.error}`)}
        </p>
      ) : state.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("synced", { count: Number(state.ok) })}
        </p>
      ) : null}
    </form>
  );
}
