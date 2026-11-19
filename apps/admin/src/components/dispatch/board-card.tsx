"use client";

import { Badge } from "@rsos/ui/badge";
import { ProviderLogo } from "@rsos/ui/provider-logo";
import type { BoardCard } from "@/lib/board";
import { ageTone, formatAge } from "@/lib/board-time";

/**
 * One request on the board. The whole card opens the side panel. Its timer reads "45s", "12m 30s",
 * "2h 14m" or "Stale · 2d"; waiting for a quote it turns amber at 3 minutes and red at 10 (with
 * text, never colour alone).
 */
export function BoardCardView({
  card: c,
  now,
  service,
  selected,
  labels,
  onOpen,
  onFocus,
}: {
  card: BoardCard;
  now: number | null;
  service: string;
  selected: boolean;
  labels: Record<string, string>;
  onOpen: () => void;
  onFocus: () => void;
}) {
  const age = now === null ? null : now - c.createdAt;
  const tone = age === null ? null : ageTone(c.lane === "new", age);
  return (
    <button
      type="button"
      data-card={c.id}
      onClick={onOpen}
      onFocus={onFocus}
      aria-label={`${c.code} · ${service}${c.demo ? ` · ${labels.demo}` : ""}`}
      className={`flex w-full flex-col gap-1.5 rounded-xl border bg-card p-3 text-left text-sm shadow-xs hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected ? "ring-2 ring-ring" : ""} ${tone === "critical" ? "border-critical" : tone === "warning" ? "border-warning" : ""}`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-semibold">
          {c.code} <span className="font-normal text-muted-foreground">· {service}</span>
        </span>
        {age !== null ? (
          <span
            className={`font-mono text-xs tabular-nums ${tone === "critical" ? "font-bold text-critical" : tone === "warning" ? "font-semibold text-warning-strong" : "text-muted-foreground"}`}
          >
            {formatAge(age, { stale: labels.stale! })}
          </span>
        ) : null}
      </span>
      <span className="w-full truncate text-muted-foreground">{c.area}</span>
      <span className="flex w-full flex-wrap items-center gap-2">
        {c.demo ? <Badge tone="outline">{labels.demo}</Badge> : null}
        {tone ? (
          <Badge tone={tone === "critical" ? "critical" : "warning"}>{labels.waiting}</Badge>
        ) : null}
        {c.quotes ? (
          <span className="text-muted-foreground">
            {labels.quotes?.replace("{count}", String(c.quotes))}
          </span>
        ) : null}
        {c.provider ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
            {c.providerLogo ? <ProviderLogo logo={c.providerLogo} size={20} /> : null}
            <span className="truncate">{c.provider}</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}
