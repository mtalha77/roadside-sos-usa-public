"use client";

import { segmentCount } from "@rsos/core/adapters";
import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { saveTemplateAction, type TextSettingsState } from "@/lib/text-settings-actions";

/** One SMS template: English and Spanish, with length and segment estimate as you type. */
export function TemplateForm({
  template,
  canEdit,
  inputClass,
}: {
  template: { key: string; title: string; body_en: string; body_es: string; urgent: boolean };
  canEdit: boolean;
  inputClass: string;
}) {
  const t = useTranslations("admin.settings.texts");
  const id = useId();
  const [en, setEn] = useState(template.body_en);
  const [es, setEs] = useState(template.body_es);
  const [state, action, pending] = useActionState<TextSettingsState, FormData>(
    saveTemplateAction,
    {},
  );
  const counter = (s: string) => t("counter", { chars: s.length, segments: segmentCount(s) });
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border p-3">
      <input type="hidden" name="key" value={template.key} />
      <p className="flex flex-wrap items-center gap-2 font-medium">
        {template.title}
        <span className="text-sm font-normal text-muted-foreground">
          {template.urgent ? t("urgent") : t("quiet")}
        </span>
      </p>
      {(
        [
          ["en", en, setEn, t("english")],
          ["es", es, setEs, t("spanish")],
        ] as const
      ).map(([name, value, set, label]) => (
        <label
          key={name}
          className="flex flex-col gap-1 text-sm font-medium"
          htmlFor={`${id}-${name}`}
        >
          {label}
          <textarea
            id={`${id}-${name}`}
            name={name}
            rows={3}
            maxLength={640}
            value={value}
            readOnly={!canEdit}
            onChange={(e) => set(e.target.value)}
            aria-describedby={`${id}-${name}-c`}
            className={`${inputClass} min-h-20 py-2`}
          />
          <span id={`${id}-${name}-c`} className="text-xs font-normal text-muted-foreground">
            {counter(value)}
          </span>
        </label>
      ))}
      {canEdit ? (
        <Button type="submit" size="sm" className="self-start" loading={pending}>
          {t("save")}
        </Button>
      ) : null}
      {state.error ? <Alert tone="critical" title={t(`errors.${state.error}`)} /> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("saved")}
        </p>
      ) : null}
    </form>
  );
}
