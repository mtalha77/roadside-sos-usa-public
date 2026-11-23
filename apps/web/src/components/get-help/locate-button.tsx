"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/lib/ui-classes";

/**
 * "Use my location": reads GPS, fills the hidden fields of its form and submits it with `stay`, so
 * the location screen comes back with the pin on the map and room for a landmark (RSOS-101). With
 * `auto` it asks as soon as the screen opens (the reason is written above it). If location is
 * denied or unavailable it says so and moves focus to the address field (the flow never blocks).
 */
export function LocateButton({
  label,
  busyLabel,
  deniedLabel,
  fallbackId,
  auto = false,
}: {
  label: string;
  busyLabel: string;
  deniedLabel: string;
  fallbackId: string;
  auto?: boolean;
}) {
  const [state, setState] = useState<"idle" | "busy" | "denied">("idle");
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (auto) button.current?.click();
  }, [auto]);
  return (
    <div className="flex flex-col gap-2">
      <button
        ref={button}
        type="button"
        className={`${ui.button.primary} w-full sm:w-auto`}
        disabled={state === "busy"}
        onClick={(e) => {
          const form = e.currentTarget.form;
          if (!form || !("geolocation" in navigator)) return setState("denied");
          setState("busy");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              (form.elements.namedItem("lat") as HTMLInputElement).value = String(
                pos.coords.latitude,
              );
              (form.elements.namedItem("lng") as HTMLInputElement).value = String(
                pos.coords.longitude,
              );
              const stay = document.createElement("input");
              stay.type = "hidden";
              stay.name = "stay";
              stay.value = "1";
              form.append(stay);
              form.requestSubmit();
            },
            () => {
              setState("denied");
              document.getElementById(fallbackId)?.focus();
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
          );
        }}
      >
        {state === "busy" ? busyLabel : label}
      </button>
      {state === "denied" ? (
        <p role="alert" className="text-sm font-medium text-critical-strong">
          {deniedLabel}
        </p>
      ) : null}
    </div>
  );
}
