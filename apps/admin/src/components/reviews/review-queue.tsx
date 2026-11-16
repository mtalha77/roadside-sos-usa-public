"use client";

import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { useState } from "react";

type Item = {
  id: string;
  provider: string;
  code: string;
  rating: number;
  driver: string;
  date: string;
};

/** Moderation queue: approve, hide, or start a follow-up for low ratings (simulated until wired). */
export function ReviewQueue({
  items,
  labels: l,
}: {
  items: Item[];
  labels: Record<string, string>;
}) {
  const [state, setState] = useState<Record<string, string>>({});
  return (
    <section aria-labelledby="rq-h" className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="rq-h" className="mb-3 font-semibold">
        {l.queue}
      </h2>
      <ul className="divide-y text-sm">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-medium">
                {r.provider} · {r.code}
              </p>
              <p className="text-muted-foreground">
                {l.stars?.replace("{n}", String(r.rating))} · {r.driver} · {r.date}{" "}
                {r.rating <= 3 ? <Badge tone="warning">{l.low}</Badge> : null}
              </p>
            </div>
            {state[r.id] ? (
              <p role="status" className="font-medium text-success-strong">
                {state[r.id]}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setState((s) => ({ ...s, [r.id]: l.approved! }))}
                >
                  {l.approve}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setState((s) => ({ ...s, [r.id]: l.hidden! }))}
                >
                  {l.hide}
                </Button>
                {r.rating <= 3 ? (
                  <Button
                    variant="ghost"
                    onClick={() => setState((s) => ({ ...s, [r.id]: l.followed! }))}
                  >
                    {l.followUp}
                  </Button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
