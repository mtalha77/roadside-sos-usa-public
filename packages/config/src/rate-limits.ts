/**
 * Rate limits for every public endpoint that sends email or texts, creates a request or accepts a
 * form (owner decision, release 1). Each endpoint can limit per IP address, per contact (the email
 * address or phone number typed in) and per market (all callers together, to cap a flood that
 * rotates IPs and contacts). Change a number here, never at the call site.
 *
 * Demo-mode hosts (previews, staging) multiply every limit by DEMO_MULTIPLIER, because the test
 * suites run from one IP and reuse markets. Production always uses the numbers below.
 */
export type RateWindow = { limit: number; windowSeconds: number };
export type RateLimitScope = "ip" | "contact" | "market";
export type EndpointLimits = Partial<Record<RateLimitScope, RateWindow>>;

const HOUR = 3600;
const TEN_MINUTES = 600;

export const RATE_LIMITS = {
  /** Get Help: creates a request (website). */
  request: {
    ip: { limit: 5, windowSeconds: HOUR },
    contact: { limit: 3, windowSeconds: HOUR },
    market: { limit: 300, windowSeconds: HOUR },
  },
  /** Contact form: stores the message and emails the team and the sender. */
  contact: {
    ip: { limit: 5, windowSeconds: HOUR },
    contact: { limit: 3, windowSeconds: HOUR },
    market: { limit: 100, windowSeconds: HOUR },
  },
  /** Provider application: stores it and emails the team and the applicant. */
  apply: {
    ip: { limit: 3, windowSeconds: HOUR },
    contact: { limit: 2, windowSeconds: HOUR },
    market: { limit: 50, windowSeconds: HOUR },
  },
  /** "Not in your area yet" waitlist (no market: the visitor is outside every market). */
  waitlist: {
    ip: { limit: 5, windowSeconds: HOUR },
    contact: { limit: 2, windowSeconds: HOUR },
  },
  /** Email sign-in codes (drivers and staff through the shared account package). */
  signInEmail: {
    ip: { limit: 10, windowSeconds: HOUR },
    contact: { limit: 3, windowSeconds: TEN_MINUTES },
  },
  /** Provider portal: email sign-in link. */
  providerEmailLink: {
    ip: { limit: 10, windowSeconds: HOUR },
    contact: { limit: 3, windowSeconds: TEN_MINUTES },
  },
  /** Provider portal: phone sign-in code (texts a code once texting is on). */
  providerPhoneCode: {
    ip: { limit: 10, windowSeconds: HOUR },
    contact: { limit: 3, windowSeconds: TEN_MINUTES },
  },
  /** Cookie choices form (writes a consent record). */
  consent: {
    ip: { limit: 30, windowSeconds: HOUR },
  },
  /** Leave beacon from the Get Help screens (writes a funnel row). */
  funnel: {
    ip: { limit: 120, windowSeconds: HOUR },
  },
} as const satisfies Record<string, EndpointLimits>;

export type RateLimitedEndpoint = keyof typeof RATE_LIMITS;

export const DEMO_MULTIPLIER = 40;

/** The limits for an endpoint, raised on demo-mode hosts. */
export function limitsFor(endpoint: RateLimitedEndpoint, demo: boolean): EndpointLimits {
  const base: EndpointLimits = RATE_LIMITS[endpoint];
  if (!demo) return base;
  return Object.fromEntries(
    Object.entries(base).map(([scope, w]) => [
      scope,
      { limit: w.limit * DEMO_MULTIPLIER, windowSeconds: w.windowSeconds },
    ]),
  ) as EndpointLimits;
}

/** Which store counts hits: Upstash when its keys are set, else Postgres, else memory. */
export type RateLimitBackend = "upstash" | "postgres" | "memory";

export function rateLimitBackend(
  env: Record<string, string | undefined> = process.env,
): RateLimitBackend {
  const has = (k: string) => (env[k] ?? "").trim().length > 0;
  if (has("UPSTASH_REDIS_REST_URL") && has("UPSTASH_REDIS_REST_TOKEN")) return "upstash";
  if (has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"))
    return "postgres";
  return "memory";
}
