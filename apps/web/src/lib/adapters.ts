import "server-only";
import { chooseMaps, type MapsAdapter } from "@rsos/core/adapters";
import { sharedRateLimitStore } from "@rsos/db/rate-limit";
import { recordUsage, type UsageVendor } from "@rsos/db/usage";
import { chooseEmailSender, sendUsageAlert } from "@rsos/emails";

/** Rate limits: Upstash when configured, else the shared Postgres counter, else memory. */
export const rateLimitStore = sharedRateLimitStore;

/** Counts a paid call and emails the owner once a day when the group passes its threshold. */
export async function countUsage(vendor: UsageVendor, units = 1) {
  const r = await recordUsage(vendor, units);
  if (r?.alert && r.threshold)
    await sendUsageAlert(chooseEmailSender(), {
      group: vendor.startsWith("maps") ? "maps" : "twilio",
      units: r.unitsToday,
      threshold: r.threshold,
      day: new Date().toISOString().slice(0, 10),
    }).catch(() => null);
}

/**
 * Maps with usage counting on every real call. The dummy (the default until Google Maps is
 * switched on with keys and MAPS_ENABLED) is free and not counted.
 */
export function maps(): MapsAdapter {
  const m = chooseMaps();
  if (m.mode === "fake") return m;
  return {
    mode: m.mode,
    autocomplete: async (...a) => (void countUsage("maps_autocomplete"), m.autocomplete(...a)),
    place: async (...a) => (void countUsage("maps_place"), m.place(...a)),
    reverseGeocode: async (...a) => (void countUsage("maps_geocode"), m.reverseGeocode(...a)),
    geocode: async (...a) => (void countUsage("maps_geocode"), m.geocode(...a)),
    route: async (...a) => (void countUsage("maps_routes"), m.route(...a)),
  };
}
