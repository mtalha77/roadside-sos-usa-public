"use client";

import { GoogleMap } from "@rsos/ui/google-map";
import type { ComponentProps } from "react";

/**
 * The website's map: Google Maps when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set (a browser key
 * restricted to our domains), otherwise the schematic map. Read as literals so Next.js inlines them.
 */
export function MapView(props: Omit<ComponentProps<typeof GoogleMap>, "apiKey" | "mapId">) {
  return (
    <GoogleMap
      {...props}
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined}
    />
  );
}
