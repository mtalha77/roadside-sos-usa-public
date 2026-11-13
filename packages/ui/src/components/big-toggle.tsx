"use client";

import { Power } from "lucide-react";
import { cn } from "../lib/cn";

export type BigToggleProps = {
  online: boolean;
  onChange: (online: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  /** Short description under the label, e.g. "You can receive requests". */
  onHint?: string;
  offHint?: string;
  disabled?: boolean;
  loading?: boolean;
};

/** The provider's "go online / go offline" switch: one big, unmistakable control. */
export function BigToggle({
  online,
  onChange,
  onLabel = "You're online",
  offLabel = "You're offline",
  onHint = "New requests can reach you",
  offHint = "Go online to receive requests",
  disabled,
  loading,
}: BigToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={online}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={() => onChange(!online)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-4 rounded-3xl border-2 p-5 text-left transition-colors duration-200 ease-standard disabled:cursor-not-allowed disabled:opacity-60",
        online ? "border-success bg-success-subtle" : "border-border bg-surface",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-16 shrink-0 place-items-center rounded-full transition-colors duration-200",
          online ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
          loading && "animate-pulse",
        )}
      >
        <Power className="size-8" />
      </span>
      <span className="flex flex-col gap-1">
        <span
          className={cn(
            "text-xl font-semibold",
            online ? "text-success-strong" : "text-foreground",
          )}
        >
          {online ? onLabel : offLabel}
        </span>
        <span className="text-muted-foreground">{online ? onHint : offHint}</span>
      </span>
    </button>
  );
}
