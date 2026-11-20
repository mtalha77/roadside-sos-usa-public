"use client";

import { Alert } from "@rsos/ui/alert";
import { Button } from "@rsos/ui/button";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { flagRequestAction } from "@/lib/flag-actions";

const REASONS = ["fake", "wrong_location", "unreachable", "unsafe", "other"] as const;

/**
 * "Flag this request" on the offer and job screens (owner decision 3): one tap opens the reasons,
 * one more tap on a reason sends the flag (the note is optional). Unsafe is urgent for our team.
 */
export function FlagRequest({ requestId, className }: { requestId: string; className?: string }) {
  const t = useTranslations("portal.flag");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle");
  const [pending, start] = useTransition();
  if (state === "sent") return <Alert tone="success" title={t("sent")} className={className} />;
  if (!open)
    return (
      <Button
        type="button"
        variant="ghost"
        className={className}
        aria-expanded={false}
        onClick={() => setOpen(true)}
      >
        {t("open")}
      </Button>
    );
  return (
    <section
      aria-labelledby={`${id}-h`}
      className={`flex flex-col gap-2 rounded-xl border p-3 ${className ?? ""}`}
    >
      <h3 id={`${id}-h`} className="font-semibold">
        {t("title")}
      </h3>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("note")}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          className="rounded-lg border border-input bg-surface p-3"
        />
      </label>
      <p className="text-sm text-muted-foreground">{t("pick")}</p>
      <div className="flex flex-col gap-2">
        {REASONS.map((r) => (
          <Button
            key={r}
            type="button"
            variant={r === "unsafe" ? "destructive" : "outline"}
            className="justify-start"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await flagRequestAction({ requestId, reason: r, note });
                setState(res.ok ? "sent" : "failed");
              })
            }
          >
            {t(`reasons.${r}`)}
          </Button>
        ))}
      </div>
      {state === "failed" ? <Alert tone="critical" title={t("failed")} /> : null}
      <Button type="button" variant="ghost" className="self-start" onClick={() => setOpen(false)}>
        {t("cancel")}
      </Button>
    </section>
  );
}
