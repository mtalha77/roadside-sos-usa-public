"use client";

import { useEffect, useState } from "react";
import { Tour, type TourEnd, type TourLabels, type TourStep } from "./tour";

export const TOUR_EVENT = "rsos:tour";

/** Starts a tour from anywhere (a "?" button, "Take the tour" in the help menu). */
export function startTour(id: string) {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: id }));
}

/**
 * Runs one tour (RSOS-105): starts on its own when `autoStart` (first sign-in: no saved progress),
 * or when `startTour(id)` is called; saves where the person stopped through `save` (a server
 * action writing the person's own row, so it follows them across devices).
 */
export function TourRunner({
  id,
  steps,
  labels,
  autoStart,
  save,
}: {
  id: string;
  steps: TourStep[];
  labels: TourLabels;
  autoStart: boolean;
  save: (tour: string, status: "started" | TourEnd, step: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  // Saving is best effort: a save cut short (a reload, a lost connection) must never surface as
  // an error; the tour simply shows again next time.
  const keep = (tour: string, status: "started" | TourEnd, step: number) => {
    save(tour, status, step).catch(() => {});
  };
  const [run, setRun] = useState(0);
  useEffect(() => {
    // Automated tests switch first-sign-in tours off (the demo accounts are shared).
    let off = false;
    try {
      off = localStorage.getItem("rsos_tours_off") === "1";
    } catch {
      /* storage unavailable */
    }
    // Let the page settle first, so the spotlight finds its targets.
    const t = autoStart && !off ? setTimeout(() => setOpen(true), 600) : undefined;
    const onStart = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) return;
      setRun((r) => r + 1);
      setOpen(true);
      save(id, "started", 0).catch(() => {});
    };
    window.addEventListener(TOUR_EVENT, onStart);
    return () => {
      clearTimeout(t);
      window.removeEventListener(TOUR_EVENT, onStart);
    };
  }, [autoStart, id, save]);
  return (
    <Tour
      key={run}
      steps={steps}
      open={open}
      labels={labels}
      onStep={(s) => keep(id, "started", s)}
      onEnd={(how, s) => {
        setOpen(false);
        keep(id, how, s);
      }}
    />
  );
}
