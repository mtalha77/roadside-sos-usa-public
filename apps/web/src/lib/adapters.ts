import "server-only";
import {
  chooseMaps,
  chooseVerify,
  type MapsAdapter,
  type VerifyAdapter,
} from "@rsos/core/adapters";
import { getRateLimitStore } from "@rsos/core/security";
import { postgresRateLimitStore, recordUsage, type UsageVendor } from "@rsos/db/usage";
import { chooseEmailSender, sendUsageAlert } from "@rsos/emails";

/** Rate limits: Upstash when configured, else the shared Postgres counter, else memory. */
export const rateLimitStore = () => getRateLimitStore(process.env, postgresRateLimitStore());

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

/** Maps with usage counting on every real call (the fake is free and not counted). */
export function maps(): MapsAdapter {
  const m = chooseMaps();
  if (m.mode === "fake") return m;
  return {
    mode: m.mode,
    autocomplete: async (...a) => (void countUsage("maps_autocomplete"), m.autocomplete(...a)),
    place: async (...a) => (void countUsage("maps_place"), m.place(...a)),
    reverseGeocode: async (...a) => (void countUsage("maps_geocode"), m.reverseGeocode(...a)),
    route: async (...a) => (void countUsage("maps_routes"), m.route(...a)),
  };
}

export function verify(): VerifyAdapter {
  const v = chooseVerify();
  if (v.mode === "fake") return v;
  return {
    mode: v.mode,
    start: async (p) => (void countUsage("twilio_verify"), v.start(p)),
    check: v.check,
  };
}
