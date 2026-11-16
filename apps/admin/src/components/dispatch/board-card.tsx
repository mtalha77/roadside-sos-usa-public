"use client";

import { Badge } from "@rsos/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rsos/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { BoardCard } from "@/lib/board";

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** One request on the board: SLA timer (amber 2 min, red 3 min without a quote) and actions. */
export function BoardCardView({
  card: c,
  now,
  service,
  market,
  note,
  labels,
  onNote,
  onCancel,
}: {
  card: BoardCard;
  now: number | null;
  service: string;
  market: string;
  note?: string;
  labels: Record<string, string>;
  onNote: (note: string) => void;
  onCancel: () => void;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const age = now === null ? null : now - c.createdAt;
  const waiting = c.lane === "new" && age !== null;
  const tone =
    waiting && age! > 180_000 ? "critical" : waiting && age! > 120_000 ? "warning" : null;
  const act = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  };
  return (
    <article
      aria-labelledby={`card-${c.id}`}
      className={`rounded-xl border bg-card p-3 text-sm shadow-xs ${tone === "critical" ? "border-critical ring-2 ring-critical/40" : tone === "warning" ? "border-warning" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`card-${c.id}`} className="font-semibold">
            {c.token || !c.demo ? (
              <Link
                href={`/requests/${encodeURIComponent(c.demo ? c.token! : c.id)}`}
                prefetch={false}
                className="underline-offset-2 hover:underline"
              >
                {c.code}
              </Link>
            ) : (
              c.code
            )}{" "}
            <span className="font-normal text-muted-foreground">· {service}</span>
          </h3>
          <p className="truncate text-muted-foreground">
            {market} · {c.area}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${labels.actions} ${c.code}`}
            className="grid size-12 shrink-0 place-items-center rounded-lg hover:bg-accent"
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => act(labels.softphone!)}>
              {labels.call}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act(labels.pushed!)}>{labels.push}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => act(labels.assigned!)}>
              {labels.assign}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const n = window.prompt(labels.note, note ?? "");
                if (n !== null) {
                  onNote(n);
                  act(labels.noted!);
                }
              }}
            >
              {labels.note}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onCancel();
              }}
            >
              {labels.cancel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={c.demo ? "outline" : "info"}>{c.demo ? labels.demo : labels.real}</Badge>
        {c.quotes ? (
          <span className="text-muted-foreground">
            {labels.quotes?.replace("{count}", String(c.quotes))}
          </span>
        ) : null}
        {c.provider ? <span className="truncate text-muted-foreground">{c.provider}</span> : null}
        {waiting ? (
          <span
            role="timer"
            className={`ml-auto font-mono tabular-nums ${tone === "critical" ? "font-bold text-critical" : tone === "warning" ? "font-semibold text-warning-strong" : "text-muted-foreground"}`}
          >
            {labels.waiting} {mmss(age!)}
          </span>
        ) : null}
      </div>
      {note ? <p className="mt-2 rounded-lg bg-muted px-2 py-1">{note}</p> : null}
      {flash ? (
        <p role="status" className="mt-2 text-success-strong">
          {flash}
        </p>
      ) : null}
    </article>
  );
}
