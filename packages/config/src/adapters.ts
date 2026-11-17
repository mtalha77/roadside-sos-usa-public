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
  ],
  texting: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID"],
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

/** Adapters that also need an on switch besides their keys (owner scope change, batch 4). */
export const ADAPTER_FLAGS: Partial<Record<AdapterName, string>> = {
  maps: "MAPS_ENABLED",
  texting: "TEXTING_ENABLED",
};

/** Deferred by the owner in batch 4 (no Google Maps, no SMS, Resend after the final domain):
 * without keys they run on the fake everywhere, production included, and are not blockers. */
export const DEFERRED_BY_OWNER: readonly AdapterName[] = ["maps", "texting", "email"];

/** real: every key present (and the flag on, where one exists). fake: keys missing outside
 * production, so the fake is used. deferred: off by the owner's decision, the fake is used.
 * missing: keys missing in production (the feature is off and must be fixed). */
export type AdapterState = "real" | "fake" | "deferred" | "missing";

type EnvSource = Record<string, string | undefined>;

export function adapterState(name: AdapterName, env: EnvSource = process.env): AdapterState {
  const present = ADAPTER_KEYS[name].every((k) => (env[k] ?? "").trim().length > 0);
  const flag = ADAPTER_FLAGS[name];
  if (present && (!flag || env[flag] === "true")) return "real";
  if (DEFERRED_BY_OWNER.includes(name)) return "deferred";
  return getSiteEnv(env) === "production" ? "missing" : "fake";
}

export function adapterStates(env: EnvSource = process.env): Record<AdapterName, AdapterState> {
  return Object.fromEntries(
    (Object.keys(ADAPTER_KEYS) as AdapterName[]).map((n) => [n, adapterState(n, env)]),
  ) as Record<AdapterName, AdapterState>;
}
