"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { MapPin } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { darkMapStyle, lightMapStyle } from "./map-styles";

export type LatLng = { lat: number; lng: number };
export type MapMarker = {
  id: string;
  kind: "driver" | "provider";
  position: LatLng;
  label: string;
};

export type MapViewProps = {
  /** Google Maps browser key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Without it a static placeholder renders. */
  apiKey?: string | null;
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  /** Accessible name, e.g. "Map showing you and the provider". */
  label: string;
  /** Placeholder text when no key is configured or the map cannot load. */
  unavailableText?: string;
  className?: string;
  /** Milliseconds a moving marker takes to glide to its new position. */
  moveDuration?: number;
};

let configuredKey: string | null = null;

/** Linear interpolation between two positions (exported for tests). */
export function interpolate(from: LatLng, to: LatLng, t: number): LatLng {
  const k = Math.min(1, Math.max(0, t));
  return { lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k };
}

/**
 * Map with our quiet light/dark styles, driver and provider markers, and a provider marker that
 * glides smoothly between location updates. Degrades to a static placeholder without a key.
 */
export function MapView({
  apiKey,
  center,
  zoom = 13,
  markers = [],
  label,
  unavailableText = "Map unavailable. Locations are shown below.",
  className,
  moveDuration = 1000,
}: MapViewProps) {
  const { resolvedTheme } = useTheme();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const overlays = useRef(
    new Map<string, { overlay: google.maps.OverlayView; pos: LatLng; set: (p: LatLng) => void }>(),
  );
  const [failed, setFailed] = useState(false);
  const enabled = Boolean(apiKey) && !failed;

  // Create the map once.
  useEffect(() => {
    if (!enabled || !host.current || map.current) return;
    let cancelled = false;
    if (configuredKey !== apiKey) {
      setOptions({ key: apiKey!, v: "weekly" });
      configuredKey = apiKey!;
    }
    importLibrary("maps")
      .then(({ Map }) => {
        if (cancelled || !host.current) return;
        map.current = new Map(host.current, {
          center,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
          styles: resolvedTheme === "dark" ? darkMapStyle : lightMapStyle,
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // Only create once per key; center/theme/markers update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, apiKey]);

  useEffect(() => {
    map.current?.setOptions({ styles: resolvedTheme === "dark" ? darkMapStyle : lightMapStyle });
  }, [resolvedTheme]);

  useEffect(() => {
    map.current?.panTo(center);
  }, [center]);

  // Sync markers; animate position changes.
  useEffect(() => {
    const m = map.current;
    if (!m || !window.google?.maps) return;
    const seen = new Set<string>();
    for (const marker of markers) {
      seen.add(marker.id);
      const existing = overlays.current.get(marker.id);
      if (existing) {
        const from = existing.pos;
        const to = marker.position;
        const startAt = performance.now();
        const step = (t: number) => {
          const p = interpolate(from, to, (t - startAt) / moveDuration);
          existing.set(p);
          if (p.lat !== to.lat || p.lng !== to.lng) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        continue;
      }
      overlays.current.set(marker.id, createMarker(m, marker));
    }
    for (const [id, o] of overlays.current) {
      if (!seen.has(id)) {
        o.overlay.setMap(null);
        overlays.current.delete(id);
      }
    }
  }, [markers, moveDuration]);

  if (!enabled) {
    return (
      <figure
        className={cn(
          "relative grid min-h-64 place-items-center overflow-hidden rounded-2xl border bg-muted",
          className,
        )}
        aria-label={label}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <figcaption className="relative flex max-w-xs flex-col items-center gap-2 p-6 text-center">
          <MapPin aria-hidden="true" className="size-8 text-muted-foreground" />
          <span className="text-muted-foreground">{unavailableText}</span>
          {markers.length > 0 ? (
            <ul className="mt-1 text-sm text-foreground">
              {markers.map((mk) => (
                <li key={mk.id}>{mk.label}</li>
              ))}
            </ul>
          ) : null}
        </figcaption>
      </figure>
    );
  }
  return (
    <div
      ref={host}
      role="region"
      aria-label={label}
      className={cn("min-h-64 overflow-hidden rounded-2xl border", className)}
    />
  );
}

function createMarker(map: google.maps.Map, marker: MapMarker) {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", marker.label);
  el.className =
    marker.kind === "driver"
      ? "size-5 rounded-full border-4 border-surface bg-info shadow-md"
      : "grid size-10 place-items-center rounded-full border-4 border-surface bg-signal shadow-lg";
  el.style.position = "absolute";
  el.style.transform = "translate(-50%, -50%)";
  let pos = marker.position;
  class HtmlMarker extends google.maps.OverlayView {
    override onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(el);
    }
    override draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(
        new google.maps.LatLng(pos.lat, pos.lng),
      );
      if (point) {
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
      }
    }
    override onRemove() {
      el.remove();
    }
  }
  const overlay = new HtmlMarker();
  overlay.setMap(map);
  const entry = {
    overlay,
    pos,
    set: (p: LatLng) => {
      pos = p;
      entry.pos = p;
      overlay.draw();
    },
  };
  return entry;
}
