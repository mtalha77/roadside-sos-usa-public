"use client";

import { IconButton } from "@rsos/ui/icon-button";
import type { TourLabels, TourStep } from "@rsos/ui/tour";
import { startTour, TourRunner } from "@rsos/ui/tour-runner";
import { CircleHelp, Compass } from "lucide-react";
import { saveTourAction } from "@/lib/tour-actions";

export type TourSet = { id: string; steps: TourStep[]; autoStart: boolean };

/** Every admin tour on the page: the role tour (first sign-in) and the page tours ("?"). */
export function AdminTours({ tours, labels }: { tours: TourSet[]; labels: TourLabels }) {
  return (
    <>
      {tours.map((t) => (
        <TourRunner
          key={t.id}
          id={t.id}
          steps={t.steps}
          labels={labels}
          autoStart={t.autoStart}
          save={saveTourAction}
        />
      ))}
    </>
  );
}

/** "Take the tour" in the help area of the menu: restarts the role tour any time. */
export function TakeTourButton({ tour, label }: { tour: string; label: string }) {
  return (
    <button
      type="button"
      data-tour="take-tour"
      onClick={() => startTour(tour)}
      className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
    >
      <Compass aria-hidden="true" className="size-5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

/** The "?" button on a page: a short tour of that page. */
export function PageTourButton({ tour, label }: { tour: string; label: string }) {
  return (
    <IconButton
      label={label}
      variant="outline"
      icon={<CircleHelp />}
      onClick={() => startTour(tour)}
    />
  );
}
