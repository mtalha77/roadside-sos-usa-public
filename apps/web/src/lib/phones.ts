import { adapterState } from "@rsos/config/adapters";
import { getSiteEnv } from "@rsos/config/site";

/**
 * Whether the website shows "Call" buttons (RSOS-100): always outside production (fake phones are
 * fine for testing), and in production only when Twilio voice is really connected, so nobody is
 * shown a number that cannot be answered.
 */
export function phonesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return getSiteEnv(env) !== "production" || adapterState("twilio", env) === "real";
}
