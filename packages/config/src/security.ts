/**
 * Security headers and Content Security Policy shared by every app.
 * Allow-list only the services the stack uses. Adding a third-party script or API?
 * Add its origin here, in the right directive, and say why.
 */
export type SecurityApp = "web" | "provider" | "admin";

const SOURCES = {
  supabase: ["https://*.supabase.co", "wss://*.supabase.co"],
  googleMaps: [
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://*.googleapis.com",
    "https://*.gstatic.com",
  ],
  stripe: ["https://js.stripe.com", "https://api.stripe.com", "https://hooks.stripe.com"],
  twilio: ["https://*.twilio.com", "wss://*.twilio.com"],
  posthog: ["https://*.posthog.com"],
  gtm: [
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
  ],
  turnstile: ["https://challenges.cloudflare.com"],
  sentry: ["https://*.ingest.sentry.io", "https://*.ingest.us.sentry.io"],
  vercel: [
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    "https://vercel.live",
    "wss://ws-us3.pusher.com",
  ],
};

export function buildCsp({ nonce, dev = false }: { nonce: string; dev?: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
      "https://maps.googleapis.com",
      "https://js.stripe.com",
      "https://challenges.cloudflare.com",
      "https://www.googletagmanager.com",
      ...SOURCES.posthog,
      "https://va.vercel-scripts.com",
      "https://vercel.live",
    ],
    // Tailwind and Next inject inline styles; styles cannot run code.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      ...SOURCES.googleMaps,
      "https://*.supabase.co",
      "https://*.stripe.com",
      ...SOURCES.gtm,
      "https://vercel.live",
      "https://vercel.com",
    ],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com", "https://vercel.live"],
    "connect-src": [
      "'self'",
      ...SOURCES.supabase,
      ...SOURCES.googleMaps,
      ...SOURCES.stripe,
      ...SOURCES.twilio,
      ...SOURCES.posthog,
      ...SOURCES.gtm,
      ...SOURCES.turnstile,
      ...SOURCES.sentry,
      ...SOURCES.vercel,
      ...(dev ? ["ws://localhost:*"] : []),
    ],
    "frame-src": [
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      ...SOURCES.turnstile,
      "https://www.googletagmanager.com",
      "https://vercel.live",
    ],
    "media-src": ["'self'", "blob:", "https://*.supabase.co", ...SOURCES.twilio],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Headers sent on every route (including static files) by next.config `headers()`. */
export function securityHeaders(app: SecurityApp): { key: string; value: string }[] {
  // Only the public website asks for location (drivers sharing where they are stranded).
  const geolocation = app === "web" ? "geolocation=(self)" : "geolocation=()";
  return [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: `${geolocation}, camera=(), microphone=(), payment=(self "https://js.stripe.com"), usb=(), browsing-topics=()`,
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}

/** Random per-request nonce (base64 of 16 random bytes). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
