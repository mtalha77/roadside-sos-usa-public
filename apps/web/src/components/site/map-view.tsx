import { mapsEnabled } from "@rsos/core/adapters";
import { GoogleMap } from "@rsos/ui/google-map";
import { LiteMap } from "@rsos/ui/lite-map";
import type { ComponentProps } from "react";

/**
 * The website's map: the schematic placeholder map (our tokens, pins from coordinates) unless
 * Google Maps is switched on (keys and MAPS_ENABLED=true; off by the owner in batch 4). Without it
 * no map JavaScript is sent at all (the website's 150 KB budget).
 */
export function MapView(props: ComponentProps<typeof LiteMap>) {
  const apiKey = mapsEnabled() ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY : undefined;
  const fallback = <LiteMap {...props} />;
  if (!apiKey) return fallback;
  return (
    <GoogleMap
      {...props}
      fallback={fallback}
      apiKey={apiKey}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined}
    />
  );
}
