"use client";

import { Button } from "@rsos/ui/button";
import { Textarea } from "@rsos/ui/input";
import { useId, useState } from "react";

/** Notes and actions for a request; each action is listed in the action log below. */
export function RequestActions({ labels }: { labels: Record<string, string> }) {
  const noteId = useId();
  const [log, setLog] = useState<{ text: string; at: string }[]>([]);
  const add = (text: string) =>
    setLog((l) => [{ text, at: new Date().toLocaleTimeString() }, ...l]);
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby={`${noteId}-h`}>
      <h2 id={`${noteId}-h`} className="mb-3 font-semibold">
        {labels.actions}
      </h2>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const text = String(new FormData(f).get("note") ?? "").trim();
          if (text) add(`${labels.note}: ${text}`);
          f.reset();
        }}
      >
        <label htmlFor={noteId} className="text-sm font-medium">
          {labels.note}
        </label>
        <Textarea id={noteId} name="note" rows={2} />
        <Button type="submit" variant="outline">
          {labels.addNote}
        </Button>
      </form>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <Button variant="outline" onClick={() => add(labels.call!)}>
          {labels.call}
        </Button>
        <Button variant="outline" onClick={() => add(labels.credit!)}>
          {labels.credit}
        </Button>
        <Button variant="outline" onClick={() => add(labels.dispute!)}>
          {labels.dispute}
        </Button>
      </div>
      <h3 className="mt-4 text-sm font-semibold">{labels.review}</h3>
      <p className="text-sm text-muted-foreground">{labels.noReview}</p>
      {log.length ? (
        <ul role="log" aria-label={labels.logged} className="mt-3 flex flex-col gap-1 text-sm">
          {log.map((x, i) => (
            <li key={i}>
              <span className="tabular-nums text-muted-foreground">{x.at}</span> {x.text}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
