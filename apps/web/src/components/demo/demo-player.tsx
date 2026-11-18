"use client";

import { type ReactNode, useEffect, useState } from "react";

const SLIDE_MS = 6000;

/**
 * The "See how it works" player (RSOS-105): five slides, six seconds each (30 seconds), playing
 * on its own with Pause and Skip; with reduced motion nothing slides or fades. Slides are rendered
 * on the server; this only shows one at a time.
 */
export function DemoPlayer({
  slides,
  labels,
  skipHref,
}: {
  slides: ReactNode[];
  labels: { pause: string; play: string; skip: string; progress: string; slide: string };
  skipHref: string;
}) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      if (i < slides.length - 1) setI(i + 1);
      else setPlaying(false);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [i, playing, slides.length]);
  const btn =
    "inline-flex min-h-touch items-center justify-center rounded-lg border px-4 font-semibold hover:bg-accent";
  return (
    <div className="flex flex-col gap-4">
      <div
        role="progressbar"
        aria-label={labels.progress}
        aria-valuemin={1}
        aria-valuemax={slides.length}
        aria-valuenow={i + 1}
        aria-valuetext={labels.slide
          .replace("{n}", String(i + 1))
          .replace("{total}", String(slides.length))}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }}
      >
        {slides.map((_, n) => (
          <span key={n} className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className={`block h-full bg-primary ${n <= i ? "w-full" : "w-0"}`} />
          </span>
        ))}
      </div>
      <div aria-live="polite" className="min-h-[22rem]">
        {slides[i]}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btn}
          aria-pressed={!playing}
          onClick={() => {
            if (!playing && i === slides.length - 1) setI(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? labels.pause : labels.play}
        </button>
        <a
          href={skipHref}
          className={`${btn} border-transparent underline-offset-2 hover:underline`}
        >
          {labels.skip}
        </a>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {labels.slide.replace("{n}", String(i + 1)).replace("{total}", String(slides.length))}
        </span>
      </div>
    </div>
  );
}
