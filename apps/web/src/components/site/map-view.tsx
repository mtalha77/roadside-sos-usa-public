import { GoogleMap } from "@rsos/ui/google-map";
import { LiteMap } from "@rsos/ui/lite-map";
import type { ComponentProps } from "react";

/**
 * The website's map: Google Maps when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set (a browser key
 * restricted to our domains), otherwise only the schematic map. Without a key no map JavaScript is
 * sent at all (the website's 150 KB budget).
 */
export function MapView(props: ComponentProps<typeof LiteMap>) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || undefined;
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
