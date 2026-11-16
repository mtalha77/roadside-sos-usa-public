"use client";

import { Button } from "@rsos/ui/button";
import { Textarea } from "@rsos/ui/input";
import { useId, useState } from "react";

/** Provider actions and notes; each action is listed in the activity log (simulated until wired). */
export function ProviderActions({ labels: l }: { labels: Record<string, string> }) {
  const id = useId();
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((x) => [`${new Date().toLocaleTimeString()} ${s}`, ...x]);
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="mb-3 font-semibold">
        {l.actions}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {(["approve", "pause", "suspend", "credit", "message", "viewAs"] as const).map((k) => (
          <Button
            key={k}
            variant={k === "approve" ? "default" : "outline"}
            onClick={() => add(`${l[k]} · ${l.done}`)}
          >
            {l[k]}
          </Button>
        ))}
      </div>
      <form
        className="mt-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const text = String(new FormData(f).get("note") ?? "").trim();
          if (text) add(`${l.note}: ${text}`);
          f.reset();
        }}
      >
        <label htmlFor={`${id}-n`} className="text-sm font-medium">
          {l.note}
        </label>
        <Textarea id={`${id}-n`} name="note" rows={2} />
        <Button type="submit" variant="outline">
          {l.addNote}
        </Button>
      </form>
      {log.length ? (
        <ul role="log" aria-label={l.actions} className="mt-3 flex flex-col gap-1 text-sm">
          {log.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
