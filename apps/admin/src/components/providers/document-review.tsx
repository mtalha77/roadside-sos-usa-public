"use client";

import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { FileText } from "lucide-react";
import { useState } from "react";

type Item = {
  id: string;
  name: string;
  market: string;
  docs: { kind: string; expires: string; state: "ok" | "pending" | "expiring" }[];
};

/** Review queue: each company's documents side by side, approve or request changes with a reason. */
export function DocumentReview({
  items,
  labels,
}: {
  items: Item[];
  labels: Record<string, string>;
}) {
  const [done, setDone] = useState<Record<string, string>>({});
  const [ok, pending, expiring] = (labels.states ?? "").split("|");
  const stateLabel = { ok, pending, expiring };
  return (
    <ul className="flex flex-col gap-4">
      {items.map((it) => (
        <li key={it.id} className="rounded-2xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {it.name} <span className="font-normal text-muted-foreground">· {it.market}</span>
            </h2>
            {done[it.id] ? (
              <p role="status" className="text-sm font-medium text-success-strong">
                {done[it.id]}
              </p>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => setDone((d) => ({ ...d, [it.id]: labels.approved! }))}>
                  {labels.approve}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const reason = window.prompt(labels.reason);
                    if (reason)
                      setDone((d) => ({ ...d, [it.id]: `${labels.requested} ${reason}` }));
                  }}
                >
                  {labels.changes}
                </Button>
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {it.docs.map((d) => (
              <figure key={d.kind} className="flex flex-col gap-2 rounded-xl border p-3">
                <div
                  role="img"
                  aria-label={`${labels.preview}: ${d.kind}`}
                  className="grid aspect-[4/3] place-items-center rounded-lg bg-muted text-muted-foreground"
                >
                  <FileText aria-hidden="true" className="size-10" />
                </div>
                <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{d.kind}</span>
                  <Badge
                    tone={
                      d.state === "ok" ? "success" : d.state === "expiring" ? "critical" : "warning"
                    }
                  >
                    {stateLabel[d.state]}
                  </Badge>
                  <span className="w-full text-muted-foreground">
                    {labels.expires} {d.expires}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
