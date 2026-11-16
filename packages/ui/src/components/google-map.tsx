"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { LiteMap, type LiteMapPoint } from "./lite-map";

/* Minimal typings for the parts of the Maps JavaScript API we use (no @types dependency). */
type LatLngLiteral = { lat: number; lng: number };
type GMap = {
  fitBounds(b: unknown, pad?: number): void;
  setCenter(c: LatLngLiteral): void;
  setZoom(z: number): void;
};
type GoogleMaps = {
  maps: {
    importLibrary(name: "maps"): Promise<{
      Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
      Circle: new (opts: Record<string, unknown>) => unknown;
      Polyline: new (opts: Record<string, unknown>) => unknown;
    }>;
    importLibrary(name: "marker"): Promise<{
      AdvancedMarkerElement: new (opts: Record<string, unknown>) => unknown;
    }>;
    importLibrary(name: "core"): Promise<{
      LatLngBounds: new () => { extend(p: LatLngLiteral): void };
      ColorScheme: { LIGHT: string; DARK: string };
    }>;
  };
};
declare global {
  interface Window {
    google?: GoogleMaps;
    __rsosMapsReady?: () => void;
  }
}

let loader: Promise<GoogleMaps> | null = null;
/** Loads the Maps JavaScript API once per page (async, after the page is interactive). */
function loadMaps(apiKey: string): Promise<GoogleMaps> {
  if (window.google?.maps) return Promise.resolve(window.google);
  loader ??= new Promise((resolve, reject) => {
    window.__rsosMapsReady = () => (window.google ? resolve(window.google) : reject());
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__rsosMapsReady`;
    s.async = true;
    s.onerror = () => {
      loader = null;
      reject(new Error("maps failed to load"));
    };
    document.head.append(s);
  });
  return loader;
}

/** Our marker glyphs (flat, token colours) instead of Google's default pins. */
function markerContent(p: LiteMapPoint): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  const color =
    p.kind === "request"
      ? "var(--critical)"
      : p.kind === "truck"
        ? "var(--foreground)"
        : p.kind === "destination"
          ? "var(--info)"
          : "var(--muted-foreground)";
  el.innerHTML =
    p.kind === "truck"
      ? `<svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="${color}" stroke="var(--background)" stroke-width="3"/><path d="M9 19h12v-6h-4l-2-3H9zM21 15h3l2 3v1h-5" fill="none" stroke="var(--background)" stroke-width="1.8" stroke-linejoin="round"/></svg>`
      : `<svg width="28" height="36" viewBox="0 0 28 36"><path d="M14 35s12-12.5 12-21A12 12 0 0 0 2 14c0 8.5 12 21 12 21z" fill="${color}" stroke="var(--background)" stroke-width="2.5"/><circle cx="14" cy="14" r="4.5" fill="var(--background)"/></svg>`;
  return el;
}

/**
 * Real map (RSOS-021b): Google Maps JavaScript API with Advanced Markers and our own glyphs,
 * following the light or dark theme. Without a browser key (previews, tests, demo) or until the
 * API loads, it shows the schematic LiteMap, so pages never wait on the map.
 */
export function GoogleMap({
  apiKey,
  mapId,
  points,
  route,
  radius,
  label,
  className,
}: {
  apiKey?: string;
  mapId?: string;
  points: LiteMapPoint[];
  route?: { from: LatLngLiteral; to: LatLngLiteral };
  radius?: { center: LatLngLiteral; miles: number };
  label: string;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const key = JSON.stringify({ points, route, radius });

  useEffect(() => {
    if (!apiKey || !el.current) return;
    let cancelled = false;
    (async () => {
      try {
        const g = await loadMaps(apiKey);
        const [
          { Map, Circle, Polyline },
          { AdvancedMarkerElement },
          { LatLngBounds, ColorScheme },
        ] = await Promise.all([
          g.maps.importLibrary("maps"),
          g.maps.importLibrary("marker"),
          g.maps.importLibrary("core"),
        ]);
        if (cancelled || !el.current) return;
        const dark = document.documentElement.classList.contains("dark");
        const map = new Map(el.current, {
          mapId: mapId || "DEMO_MAP_ID",
          colorScheme: dark ? ColorScheme.DARK : ColorScheme.LIGHT,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        const bounds = new LatLngBounds();
        for (const p of points) {
          new AdvancedMarkerElement({
            map,
            position: p,
            title: p.label,
            content: markerContent(p),
          });
          bounds.extend(p);
        }
        if (route) {
          new Polyline({
            map,
            path: [route.from, route.to],
            strokeOpacity: 0,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 0.9, scale: 3 },
                offset: "0",
                repeat: "14px",
              },
            ],
          });
          bounds.extend(route.from);
          bounds.extend(route.to);
        }
        if (radius) {
          new Circle({
            map,
            center: radius.center,
            radius: radius.miles * 1609.344,
            strokeWeight: 1.5,
            fillOpacity: 0.08,
            clickable: false,
          });
          bounds.extend(radius.center);
        }
        if (points.length + (route ? 2 : 0) + (radius ? 1 : 0) > 1) map.fitBounds(bounds, 48);
        else if (points[0]) {
          map.setCenter(points[0]);
          map.setZoom(15);
        }
        setReady(true);
      } catch {
        // Key restricted, blocked or offline: keep the schematic map.
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` captures every input; re-render the map when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, mapId, key]);

  if (!apiKey)
    return (
      <LiteMap points={points} route={route} radius={radius} label={label} className={className} />
    );
  return (
    <div className={cn("relative", className)}>
      {ready ? null : (
        <LiteMap
          points={points}
          route={route}
          radius={radius}
          label={label}
          className="absolute inset-0"
        />
      )}
      <div
        ref={el}
        role="img"
        aria-label={label}
        className={cn(
          "aspect-[16/10] w-full overflow-hidden rounded-2xl border",
          ready ? "" : "invisible",
        )}
      />
    </div>
  );
}
