import { getSiteEnv } from "./site";

/**
 * Third-party adapters (batch 4) and the environment variables each one needs for its real
 * implementation. Only NAMES live here; values are read on the server and never reported.
 */
export const ADAPTER_KEYS = {
  twilio: [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_API_KEY_SID",
    "TWILIO_API_KEY_SECRET",
    "TWILIO_MESSAGING_SERVICE_SID",
  ],
  twilioVerify: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"],
  softphone: [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY_SID",
    "TWILIO_API_KEY_SECRET",
    "TWILIO_TWIML_APP_SID",
  ],
  maps: ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "GOOGLE_MAPS_SERVER_KEY"],
  email: ["RESEND_API_KEY"],
  turnstile: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"],
  rateLimit: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  analytics: ["NEXT_PUBLIC_GTM_ID"],
} as const satisfies Record<string, readonly string[]>;

export type AdapterName = keyof typeof ADAPTER_KEYS;
/** real: every key present. fake: keys missing outside production, so the fake is used. missing:
 * keys missing in production (the feature is off and must be fixed). */
export type AdapterState = "real" | "fake" | "missing";

type EnvSource = Record<string, string | undefined>;

export function adapterState(name: AdapterName, env: EnvSource = process.env): AdapterState {
  const present = ADAPTER_KEYS[name].every((k) => (env[k] ?? "").trim().length > 0);
  if (present) return "real";
  return getSiteEnv(env) === "production" ? "missing" : "fake";
}

export function adapterStates(env: EnvSource = process.env): Record<AdapterName, AdapterState> {
  return Object.fromEntries(
    (Object.keys(ADAPTER_KEYS) as AdapterName[]).map((n) => [n, adapterState(n, env)]),
  ) as Record<AdapterName, AdapterState>;
}
