"use client";

import { cn } from "../lib/cn";
import { useNow } from "../lib/use-now";

/** Pulsing dot meaning "this updates live". Decorative: pair it with text. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-2.5", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex size-2.5 rounded-full bg-success" />
    </span>
  );
}

export type UpdatedAgoProps = {
  /** Epoch milliseconds of the last update. */
  at: number;
  format?: (seconds: number) => string;
  className?: string;
};

const defaultFormat = (s: number) =>
  s < 5
    ? "Updated just now"
    : s < 60
      ? `Updated ${s} seconds ago`
      : `Updated ${Math.floor(s / 60)} min ago`;

/** "Updated x seconds ago" with a live dot; stays correct after the tab was in the background. */
export function UpdatedAgo({ at, format = defaultFormat, className }: UpdatedAgoProps) {
  const now = useNow(1000);
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground tabular-nums",
        className,
      )}
    >
      <LiveDot />
      <time dateTime={new Date(at).toISOString()}>{format(seconds)}</time>
    </span>
  );
}
