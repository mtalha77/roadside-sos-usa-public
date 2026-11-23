"use client";

import type { TourLabels, TourStep } from "@rsos/ui/tour";
import { startTour, TourRunner } from "@rsos/ui/tour-runner";
import { Compass } from "lucide-react";
import { saveTourAction } from "@/lib/tour-actions";

/** The role's portal tour: on its own the first time, or from "Take the tour". */
export function PortalTour(props: {
  id: string;
  steps: TourStep[];
  labels: TourLabels;
  autoStart: boolean;
}) {
  return <TourRunner {...props} save={saveTourAction} />;
}

export function TakeTourButton({
  tour,
  label,
  className,
}: {
  tour: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-tour="take-tour"
      onClick={() => startTour(tour)}
      className={className}
    >
      <Compass aria-hidden="true" className="size-5 text-muted-foreground" />
      {label}
    </button>
  );
}
