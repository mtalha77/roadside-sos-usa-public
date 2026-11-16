"use client";

import { useCallback, useEffect, useState } from "react";

type Saved = { base: number; anchor: number; speed: number };
const key = (token: string) => `rsos_demo_clock_${token}`;

/**
 * The driver's demo clock: seconds into the demo, running at 1x or 5x, which Back, Next, the
 * stepper and "Skip to arrival" move. Kept in the browser per request so a reload resumes it.
 * A fresh demo starts at the beginning. Only used for demo requests (real requests keep real time).
 */
export function useDemoClock(token: string, enabled: boolean) {
  const [state, setState] = useState<Saved>(() => ({ base: 0, anchor: Date.now(), speed: 1 }));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(key(token));
      if (raw) {
        const saved = JSON.parse(raw) as Saved;
        if (Number.isFinite(saved.base) && Number.isFinite(saved.anchor))
          queueMicrotask(() => setState(saved));
      }
    } catch {
      // Unreadable or blocked storage: start fresh.
    }
    // Four ticks a second so the truck moves smoothly at 5x.
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [enabled, token]);

  const save = useCallback(
    (next: Saved) => {
      setState(next);
      try {
        localStorage.setItem(key(token), JSON.stringify(next));
      } catch {
        // Private mode: the demo still works for this visit.
      }
    },
    [token],
  );

  const elapsed = state.base + ((now - state.anchor) / 1000) * state.speed;

  /** Jump to a point in the demo (seconds), keeping the speed. */
  const jumpTo = useCallback(
    (sec: number) => save({ base: Math.max(0, sec), anchor: Date.now(), speed: state.speed }),
    [save, state.speed],
  );
  const setSpeed = useCallback(
    (speed: number) => {
      const t = Date.now();
      save({ base: state.base + ((t - state.anchor) / 1000) * state.speed, anchor: t, speed });
    },
    [save, state],
  );

  return { elapsed, speed: state.speed, jumpTo, setSpeed };
}
