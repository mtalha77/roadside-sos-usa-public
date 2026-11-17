import { z } from "zod";

/** First-touch attribution (RSOS-031): kept in an HttpOnly first-party cookie for 90 days. */
export const ATTRIBUTION_COOKIE = "rsos_attr";

const KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export const AttributionSchema = z.object({
  gclid: z.string().max(200).nullable().default(null),
  gbraid: z.string().max(200).nullable().default(null),
  wbraid: z.string().max(200).nullable().default(null),
  fbclid: z.string().max(200).nullable().default(null),
  msclkid: z.string().max(200).nullable().default(null),
  utm_source: z.string().max(200).nullable().default(null),
  utm_medium: z.string().max(200).nullable().default(null),
  utm_campaign: z.string().max(200).nullable().default(null),
  utm_term: z.string().max(200).nullable().default(null),
  utm_content: z.string().max(200).nullable().default(null),
  landing_page: z.string().max(300).nullable().default(null),
  referrer: z.string().max(200).nullable().default(null),
  market: z.string().max(60).nullable().default(null),
});
export type Attribution = z.infer<typeof AttributionSchema>;

/** The market a landing URL belongs to: /lp/<market>/..., /roadside-assistance/<state>/<market>. */
export function marketFromPath(path: string): string | null {
  const m = /^\/(?:lp\/([a-z0-9-]+)|roadside-assistance\/[a-z]{2}\/([a-z0-9-]+))/.exec(path);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

/** Reads click ids, campaign, landing page, referrer host and market from the first request. */
export function firstTouch(request: {
  nextUrl: { pathname: string; searchParams: URLSearchParams };
  headers: Headers;
}): Attribution {
  const q = request.nextUrl.searchParams;
  const pick = (k: string) => {
    const v = q.get(k);
    return v ? v.slice(0, 200) : null;
  };
  let referrer: string | null = null;
  try {
    const r = request.headers.get("referer");
    referrer = r ? new URL(r).host.slice(0, 200) : null;
  } catch {
    referrer = null;
  }
  return AttributionSchema.parse({
    ...Object.fromEntries(KEYS.map((k) => [k, pick(k)])),
    landing_page: request.nextUrl.pathname.slice(0, 300),
    referrer,
    market: marketFromPath(request.nextUrl.pathname),
  });
}

export const encodeAttribution = (a: Attribution) =>
  encodeURIComponent(
    JSON.stringify(Object.fromEntries(Object.entries(a).filter(([, v]) => v !== null))),
  );

export function decodeAttribution(raw: string | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = AttributionSchema.safeParse(JSON.parse(decodeURIComponent(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
