"use client";

import { Switch } from "@rsos/ui/switch";
import { useId, useState } from "react";

/** Feature flags (kept on this page until a flags table exists). */
export function FlagsPanel({
  flags,
  labels,
}: {
  flags: { id: string; label: string; hint: string }[];
  labels: { saved: string; title: string };
}) {
  const base = useId();
  const [on, setOn] = useState<Record<string, boolean>>({ spanish_site: true, phone_intake: true });
  const [last, setLast] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby={`${base}-h`}>
      <h2 id={`${base}-h`} className="mb-2 font-semibold">
        {labels.title}
      </h2>
      <ul className="divide-y">
        {flags.map((f) => (
          <li key={f.id} className="flex min-h-16 items-center justify-between gap-4 py-2">
            <label htmlFor={`${base}-${f.id}`} className="font-medium">
              {f.label}
              <span className="block text-sm font-normal text-muted-foreground">{f.hint}</span>
            </label>
            <Switch
              id={`${base}-${f.id}`}
              checked={Boolean(on[f.id])}
              onCheckedChange={(v) => {
                setOn((x) => ({ ...x, [f.id]: v }));
                setLast(f.label);
              }}
            />
          </li>
        ))}
      </ul>
      {last ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {labels.saved.replace("{flag}", last)}
        </p>
      ) : null}
    </section>
  );
}
