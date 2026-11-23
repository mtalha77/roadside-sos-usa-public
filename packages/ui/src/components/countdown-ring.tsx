"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { useNow } from "../lib/use-now";

export type CountdownRingProps = {
  /** Epoch ms when the countdown started and when it ends. */
  startsAt: number;
  endsAt: number;
  /** Visible label inside the ring, e.g. remaining time. */
  format?: (secondsLeft: number) => string;
  /** Screen reader sentence, announced at most once a minute and in the last 30 seconds. */
  srLabel?: (secondsLeft: number) => string;
  /** Accessible name of the timer. */
  label: string;
  size?: number;
  onComplete?: () => void;
  className?: string;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Smooth ring that is always correct: remaining time is computed from Date.now() against the
 * end timestamp, so a throttled background tab shows the right value the moment it returns.
 */
export function CountdownRing({
  startsAt,
  endsAt,
  format = mmss,
  srLabel = (s) => `${mmss(s)} left`,
  label,
  size = 160,
  onComplete,
  className,
}: CountdownRingProps) {
  const now = useNow(250);
  const total = Math.max(1, endsAt - startsAt);
  const leftMs = Math.max(0, endsAt - now);
  const secondsLeft = Math.ceil(leftMs / 1000);
  const fraction = leftMs / total;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  // Announce sparingly: every whole minute, and every 10 s in the last 30 s.
  const [announcement, setAnnouncement] = useState(() => srLabel(secondsLeft));
  const lastAnnounced = useRef(secondsLeft);
  const done = useRef(false);
  useEffect(() => {
    const shouldAnnounce =
      (secondsLeft % 60 === 0 || (secondsLeft <= 30 && secondsLeft % 10 === 0)) &&
      secondsLeft !== lastAnnounced.current;
    if (shouldAnnounce) {
      lastAnnounced.current = secondsLeft;
      setAnnouncement(srLabel(secondsLeft));
    }
    if (secondsLeft === 0 && !done.current) {
      done.current = true;
      onComplete?.();
    }
  }, [secondsLeft, srLabel, onComplete]);

  return (
    <div
      role="timer"
      aria-label={label}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          className="stroke-signal transition-[stroke-dashoffset] duration-250 ease-linear motion-reduce:transition-none"
        />
      </svg>
      <span aria-hidden="true" className="absolute text-3xl font-semibold tabular-nums">
        {format(secondsLeft)}
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
