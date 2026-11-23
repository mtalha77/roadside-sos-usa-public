import "server-only";
import { createPublicSupabase } from "./public";

/**
 * Paid API usage (RSOS-021b) and the Postgres rate limiter (used while Upstash is not set up).
 * Both go through definer functions with the public key, so every app (including the website,
 * which has no service key) can call them; neither returns any secret.
 */

export type UsageVendor =
  "maps_autocomplete" | "maps_place" | "maps_geocode" | "maps_routes" | "maps_js" | "twilio_sms";

export type UsageResult = { unitsToday: number; threshold: number | null; alert: boolean };

/** Counts usage; `alert` is true once per vendor group per day, when the threshold is crossed. */
export async function recordUsage(vendor: UsageVendor, units = 1): Promise<UsageResult | null> {
  const supabase = createPublicSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("record_api_usage", {
      p_vendor: vendor,
      p_units: units,
    });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) return null;
    return { unitsToday: row.units_today, threshold: row.threshold ?? null, alert: row.alert };
  } catch {
    return null;
  }
}

/** Rate-limit store on Postgres (`rate_limit_hit`); null when Supabase is not configured. */
export function postgresRateLimitStore(): {
  increment(key: string, windowSeconds: number): Promise<number>;
} | null {
  const supabase = createPublicSupabase();
  if (!supabase) return null;
  return {
    async increment(key, windowSeconds) {
      const { data, error } = await supabase.rpc("rate_limit_hit", {
        p_key: key.slice(0, 200),
        p_window_seconds: windowSeconds,
      });
      if (error || typeof data !== "number") throw new Error("rate limit store unavailable");
      return data;
    },
  };
}
