"use client";

import { Check } from "lucide-react";

/**
 * The request's stages, left to right: Finding, Quotes, Confirm, On the way, Arrived, Completed.
 * In demo mode a past stage is a button that goes back to it; real requests only show progress.
 */
export function StageStepper({
  stages,
  current,
  label,
  onGoTo,
  goToLabel,
}: {
  stages: { id: string; label: string }[];
  current: number;
  label: string;
  /** Demo only: go back to a past stage. */
  onGoTo?: (index: number) => void;
  goToLabel?: (stage: string) => string;
}) {
  return (
    <nav aria-label={label}>
      <ol className="grid grid-cols-6 gap-1">
        {stages.map((s, i) => {
          const done = i < current;
          const now = i === current;
          const dot = (
            <span
              aria-hidden="true"
              className={
                "grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums " +
                (done
                  ? "bg-foreground text-background"
                  : now
                    ? "border-2 border-foreground"
                    : "border border-border text-muted-foreground")
              }
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
          );
          const text = (
            <span
              className={
                "text-center text-xs leading-tight " +
                (now ? "font-semibold" : done ? "" : "text-muted-foreground")
              }
            >
              {s.label}
            </span>
          );
          return (
            <li key={s.id} aria-current={now ? "step" : undefined}>
              {done && onGoTo ? (
                <button
                  type="button"
                  onClick={() => onGoTo(i)}
                  aria-label={goToLabel?.(s.label)}
                  className="flex min-h-touch w-full flex-col items-center gap-1 rounded-lg py-1 hover:bg-accent"
                >
                  {dot}
                  {text}
                </button>
              ) : (
                <div className="flex min-h-touch w-full flex-col items-center gap-1 py-1">
                  {dot}
                  {text}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Small demo-only bar: Back, Next, speed (1x, 5x) and Skip to arrival. */
export function DemoBar({
  labels,
  speed,
  canBack,
  canNext,
  canSkip,
  onBack,
  onNext,
  onSpeed,
  onSkip,
}: {
  labels: Record<"title" | "back" | "next" | "speed" | "skip", string> & {
    speedValue: (x: number) => string;
  };
  speed: number;
  canBack: boolean;
  canNext: boolean;
  canSkip: boolean;
  onBack: () => void;
  onNext: () => void;
  onSpeed: (speed: number) => void;
  onSkip: () => void;
}) {
  const btn =
    "inline-flex min-h-touch items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50";
  return (
    <section
      aria-label={labels.title}
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed bg-muted/50 p-2"
    >
      <span className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {labels.title}
      </span>
      <button type="button" className={btn} onClick={onBack} disabled={!canBack}>
        {labels.back}
      </button>
      <button type="button" className={btn} onClick={onNext} disabled={!canNext}>
        {labels.next}
      </button>
      <div role="radiogroup" aria-label={labels.speed} className="flex gap-1">
        {[1, 5].map((x) => (
          <button
            key={x}
            type="button"
            role="radio"
            aria-checked={speed === x}
            onClick={() => onSpeed(x)}
            className={`${btn} min-w-touch font-mono tabular-nums aria-checked:bg-foreground aria-checked:text-background`}
          >
            {labels.speedValue(x)}
          </button>
        ))}
      </div>
      <button type="button" className={btn} onClick={onSkip} disabled={!canSkip}>
        {labels.skip}
      </button>
    </section>
  );
}
