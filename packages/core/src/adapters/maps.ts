import { z } from "zod";

/**
 * Maps adapter (batch 4). The dummy implementation is used everywhere for now (owner scope
 * change: no Google Maps in this batch): typed addresses without autocomplete or geocoding,
 * browser GPS stored as coordinates, straight-line (haversine) distance and an ETA from an average
 * speed in config. The Google adapter (Places Autocomplete (New), place details, reverse
 * geocoding, Routes over REST with the server key) is written and unit tested against mocks but
 * switched off: turning it on needs only the keys and MAPS_ENABLED=true.
 */

export type LatLng = { lat: number; lng: number };
export type PlaceSuggestion = { placeId: string; text: string; secondary: string };
export type Place = { address: string; lat: number; lng: number };
export type ReverseResult = { address: string; highway: string | null };
export type RouteEstimate = { meters: number; seconds: number };

export interface MapsAdapter {
  readonly mode: "real" | "fake";
  autocomplete(
    input: string,
    opts: { bias?: LatLng; sessionToken?: string },
  ): Promise<PlaceSuggestion[]>;
  place(placeId: string, opts?: { sessionToken?: string }): Promise<Place | null>;
  reverseGeocode(point: LatLng): Promise<ReverseResult | null>;
  route(from: LatLng, to: LatLng): Promise<RouteEstimate | null>;
}

const R = 3958.8;
export function milesBetweenPoints(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Average driving speed for dummy ETAs (config; MAPS_AVG_SPEED_MPH overrides, 5 to 80 mph). */
export const DEFAULT_AVG_SPEED_MPH = 30;
export function averageSpeedMph(env: Record<string, string | undefined> = process.env): number {
  const v = Number(env.MAPS_AVG_SPEED_MPH);
  return Number.isFinite(v) && v >= 5 && v <= 80 ? v : DEFAULT_AVG_SPEED_MPH;
}

/** Straight-line (haversine) distance; ETA = distance / average speed. The dummy's route. */
export function estimateRoute(
  from: LatLng,
  to: LatLng,
  mph: number = DEFAULT_AVG_SPEED_MPH,
): RouteEstimate {
  const miles = milesBetweenPoints(from, to);
  return { meters: Math.round(miles * 1609.344), seconds: Math.round((miles / mph) * 3600) };
}

/** US street address format check for typed addresses (no geocoding): a number and a street,
 * or a highway with a mile marker or exit, or a cross street ("Main St and 5th St"). */
export function isPlausibleAddress(raw: string): boolean {
  const s = raw.trim().replace(/\s+/g, " ");
  if (s.length < 5 || s.length > 200) return false;
  if (!/[a-z]{2}/i.test(s)) return false;
  return (
    /^\d{1,6}[a-z]?\s+\S+/i.test(s) ||
    highwayFrom(s) !== null ||
    /\b(mile( marker)?|mm|exit)\s*\d+/i.test(s) ||
    /\S+\s+(and|&|at|near)\s+\S+/i.test(s)
  );
}

/** Pulls a highway name ("I-35", "US-90", "TX-1604", "Loop 410") out of an address, if any. */
export function highwayFrom(text: string): string | null {
  const m =
    /\b(I|US|SR|TX|NV|State Highway|Hwy|Highway)[ -]?(\d{1,4}[A-Z]?)\b/i.exec(text) ??
    /\b(Loop|Beltway|Spur|Interstate) (\d{1,4})\b/i.exec(text);
  if (!m) return null;
  const kind = m[1]!.toUpperCase();
  if (kind === "INTERSTATE") return `I-${m[2]}`;
  if (["LOOP", "BELTWAY", "SPUR"].includes(kind))
    return `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1).toLowerCase()} ${m[2]}`;
  if (["HWY", "HIGHWAY", "STATE HIGHWAY"].includes(kind)) return `Hwy ${m[2]}`;
  return `${kind}-${m[2]}`;
}

export function createFakeMaps(mph: number = DEFAULT_AVG_SPEED_MPH): MapsAdapter {
  return {
    mode: "fake",
    async autocomplete(input, opts) {
      const q = input.trim();
      if (q.length < 3) return [];
      // One suggestion that echoes the typed address, placed at the bias point.
      const at = opts.bias ? `${opts.bias.lat.toFixed(5)},${opts.bias.lng.toFixed(5)}` : "0,0";
      return [{ placeId: `fake:${at}:${encodeURIComponent(q)}`, text: q, secondary: "" }];
    },
    async place(placeId) {
      const m = /^fake:(-?\d+\.\d+),(-?\d+\.\d+):(.+)$/.exec(placeId);
      if (!m) return null;
      return { lat: Number(m[1]), lng: Number(m[2]), address: decodeURIComponent(m[3]!) };
    },
    async reverseGeocode() {
      return null;
    },
    async route(from, to) {
      return estimateRoute(from, to, mph);
    },
  };
}

const AutocompleteResponse = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string(),
            structuredFormat: z
              .object({
                mainText: z.object({ text: z.string() }),
                secondaryText: z.object({ text: z.string() }).optional(),
              })
              .optional(),
            text: z.object({ text: z.string() }),
          })
          .optional(),
      }),
    )
    .optional(),
});
const PlaceResponse = z.object({
  formattedAddress: z.string(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
});
const GeocodeResponse = z.object({
  status: z.string(),
  results: z.array(
    z.object({
      formatted_address: z.string(),
      address_components: z.array(z.object({ long_name: z.string(), types: z.array(z.string()) })),
    }),
  ),
});
const RoutesResponse = z.object({
  routes: z
    .array(z.object({ distanceMeters: z.number().optional(), duration: z.string().optional() }))
    .optional(),
});

export function createGoogleMaps(serverKey: string, fetchImpl: typeof fetch = fetch): MapsAdapter {
  const json = async (url: string, init: RequestInit): Promise<unknown> => {
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`maps ${res.status}`);
    return res.json();
  };
  const headers = (fieldMask: string) => ({
    "Content-Type": "application/json",
    "X-Goog-Api-Key": serverKey,
    "X-Goog-FieldMask": fieldMask,
  });
  return {
    mode: "real",
    async autocomplete(input, opts) {
      if (input.trim().length < 3) return [];
      try {
        const body = {
          input,
          includedRegionCodes: ["us"],
          ...(opts.sessionToken ? { sessionToken: opts.sessionToken } : {}),
          ...(opts.bias
            ? {
                locationBias: {
                  circle: {
                    center: { latitude: opts.bias.lat, longitude: opts.bias.lng },
                    radius: 50000,
                  },
                },
              }
            : {}),
        };
        const data = AutocompleteResponse.parse(
          await json("https://places.googleapis.com/v1/places:autocomplete", {
            method: "POST",
            headers: headers(
              "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
            ),
            body: JSON.stringify(body),
          }),
        );
        return (data.suggestions ?? []).flatMap((s) =>
          s.placePrediction
            ? [
                {
                  placeId: s.placePrediction.placeId,
                  text:
                    s.placePrediction.structuredFormat?.mainText.text ??
                    s.placePrediction.text.text,
                  secondary: s.placePrediction.structuredFormat?.secondaryText?.text ?? "",
                },
              ]
            : [],
        );
      } catch {
        return [];
      }
    },
    async place(placeId, opts) {
      if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return null;
      try {
        const q = opts?.sessionToken
          ? `?sessionToken=${encodeURIComponent(opts.sessionToken)}`
          : "";
        const data = PlaceResponse.parse(
          await json(`https://places.googleapis.com/v1/places/${placeId}${q}`, {
            method: "GET",
            headers: headers("formattedAddress,location"),
          }),
        );
        return {
          address: data.formattedAddress,
          lat: data.location.latitude,
          lng: data.location.longitude,
        };
      } catch {
        return null;
      }
    },
    async reverseGeocode(point) {
      try {
        const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
        url.searchParams.set("latlng", `${point.lat},${point.lng}`);
        url.searchParams.set("key", serverKey);
        const data = GeocodeResponse.parse(await json(url.toString(), { method: "GET" }));
        const first = data.results[0];
        if (data.status !== "OK" || !first) return null;
        const route = first.address_components.find((c) => c.types.includes("route"))?.long_name;
        return {
          address: first.formatted_address,
          highway: highwayFrom(route ?? "") ?? highwayFrom(first.formatted_address),
        };
      } catch {
        return null;
      }
    },
    async route(from, to) {
      try {
        const data = RoutesResponse.parse(
          await json("https://routes.googleapis.com/directions/v2:computeRoutes", {
            method: "POST",
            headers: headers("routes.duration,routes.distanceMeters"),
            body: JSON.stringify({
              origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
              destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
              travelMode: "DRIVE",
              routingPreference: "TRAFFIC_AWARE",
            }),
          }),
        );
        const r = data.routes?.[0];
        if (!r?.distanceMeters || !r.duration) return null;
        return { meters: r.distanceMeters, seconds: Number.parseInt(r.duration, 10) };
      } catch {
        return null;
      }
    },
  };
}

/** The Google adapter is on only with MAPS_ENABLED=true and both keys (browser and server). */
export function mapsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.MAPS_ENABLED === "true" &&
    Boolean(env.GOOGLE_MAPS_SERVER_KEY?.trim()) &&
    Boolean(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim())
  );
}

/** Real Google Maps when switched on (keys and flag); otherwise the dummy. */
export function chooseMaps(env: Record<string, string | undefined> = process.env): MapsAdapter {
  return mapsEnabled(env)
    ? createGoogleMaps(env.GOOGLE_MAPS_SERVER_KEY!.trim())
    : createFakeMaps(averageSpeedMph(env));
}
