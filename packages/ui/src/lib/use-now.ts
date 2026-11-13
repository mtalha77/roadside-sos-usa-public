"use client";

import { useEffect, useState } from "react";

/**
 * Current time, refreshed every `intervalMs` and immediately when the tab becomes visible again.
 * Timers are throttled in background tabs, so anything time-based must derive from Date.now()
 * (never count ticks). This hook guarantees a fresh value when the user comes back.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [intervalMs]);
  return now;
}
