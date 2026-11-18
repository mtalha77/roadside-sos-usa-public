"use client";

import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";

export type TourStep = {
  /** CSS selector of the element to spotlight; the first visible match wins. None: centered. */
  target?: string;
  title: string;
  body: string;
};
export type TourLabels = {
  back: string;
  next: string;
  done: string;
  skip: string;
  hide: string;
  /** "Step {n} of {total}". */
  step: string;
};
export type TourEnd = "done" | "skipped" | "hidden";

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Guided tour (RSOS-105): spotlights one element at a time with a short title and one sentence,
 * plus Back, Next, Skip tour and "Don't show again". A modal dialog: focus moves into the card and
 * stays there, Escape skips, arrow keys move between steps. On phones the card sits at the bottom.
 * Smooth scrolling and transitions are off with reduced motion. Our own code: no tour library.
 */
export function Tour({
  steps,
  open,
  start = 0,
  labels,
  onEnd,
  onStep,
}: {
  steps: TourStep[];
  open: boolean;
  start?: number;
  labels: TourLabels;
  onEnd: (how: TourEnd, step: number) => void;
  onStep?: (step: number) => void;
}) {
  const [i, setI] = useState(start);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const step = steps[Math.min(i, steps.length - 1)];

  const measure = useCallback(() => {
    if (!step?.target) return setRect(null);
    const el = [...document.querySelectorAll(step.target)].find(visible);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Bring the target into view, then measure it (and again while the page moves).
  useEffect(() => {
    if (!open || !step) return;
    const el = step.target ? [...document.querySelectorAll(step.target)].find(visible) : null;
    el?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    const t = setTimeout(measure, reducedMotion() ? 0 : 350);
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, measure]);

  // Focus the card on every step so screen readers read the new title and sentence.
  useEffect(() => {
    if (!open) return;
    card.current?.focus();
    // Again after a closing menu or dialog has returned focus to its trigger.
    const t = setTimeout(() => card.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [open, i]);

  if (!open || !step || typeof document === "undefined") return null;
  const last = i >= steps.length - 1;
  const go = (n: number) => {
    const next = Math.max(0, Math.min(steps.length - 1, n));
    setI(next);
    onStep?.(next);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onEnd("skipped", i);
    } else if (e.key === "ArrowRight" && !last) go(i + 1);
    else if (e.key === "ArrowLeft" && i > 0) go(i - 1);
    else if (e.key === "Tab") {
      // Keep focus inside the card (a modal dialog).
      const f = [...(card.current?.querySelectorAll<HTMLElement>("button") ?? [])];
      if (!f.length) return;
      const first = f[0]!;
      const end = f[f.length - 1]!;
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === card.current)
      ) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const pad = 6;
  // Desktop: below the target when there is room, otherwise above; phones: bottom of the screen.
  const below = rect ? rect.bottom + 220 < window.innerHeight : true;
  const place =
    rect && window.innerWidth >= 640
      ? {
          top: below ? rect.bottom + pad + 10 : undefined,
          bottom: below ? undefined : window.innerHeight - rect.top + pad + 10,
          left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)),
        }
      : null;
  const btn =
    "inline-flex min-h-touch items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return createPortal(
    <div className="fixed inset-0 z-[70]" data-tour-open="">
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl ring-2 ring-primary transition-all duration-200 motion-reduce:transition-none"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px color-mix(in oklab, var(--foreground) 55%, transparent)",
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-foreground/55" />
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={onKey}
        className={cn(
          "fixed flex flex-col gap-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none",
          place
            ? "w-[22rem]"
            : "inset-x-3 bottom-3 sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:w-[24rem] sm:-translate-x-1/2 sm:-translate-y-1/2",
          place ? "" : "pb-[max(1rem,env(safe-area-inset-bottom))]",
        )}
        style={place ?? undefined}
      >
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {labels.step.replace("{n}", String(i + 1)).replace("{total}", String(steps.length))}
        </p>
        <h2 id={titleId} className="text-lg leading-tight font-semibold">
          {step.title}
        </h2>
        <p id={bodyId} className="text-sm text-muted-foreground">
          {step.body}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className={cn(btn, "hover:bg-accent")}
            onClick={() => onEnd("skipped", i)}
          >
            {labels.skip}
          </button>
          <span className="flex-1" />
          {i > 0 ? (
            <button
              type="button"
              className={cn(btn, "border hover:bg-accent")}
              onClick={() => go(i - 1)}
            >
              {labels.back}
            </button>
          ) : null}
          <button
            type="button"
            className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")}
            onClick={() => (last ? onEnd("done", i) : go(i + 1))}
          >
            {last ? labels.done : labels.next}
          </button>
        </div>
        <button
          type="button"
          className={cn(
            btn,
            "min-h-10 self-start px-0 font-medium text-muted-foreground underline-offset-2 hover:underline",
          )}
          onClick={() => onEnd("hidden", i)}
        >
          {labels.hide}
        </button>
      </div>
    </div>,
    document.body,
  );
}
