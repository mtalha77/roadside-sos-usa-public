import { adapterState } from "./adapters";
import { getSiteEnv } from "./site";

/**
 * Whether phone calls are offered (RSOS-100, RSOS-110): always outside production (fake phones
 * are fine for testing), and in production only when Twilio voice is really connected, so nobody
 * is shown a number that cannot be answered. The website shows call links and the admin shows
 * Calls only when this is true.
 */
export function phonesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return getSiteEnv(env) !== "production" || adapterState("twilio", env) === "real";
}
