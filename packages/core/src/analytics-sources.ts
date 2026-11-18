/**
 * Sources and channels (RSOS-113 E). A source is where the customer came from; a channel is how
 * the request reached us. They are different things and are counted in separate tables.
 */
export const SOURCES = [
  "google_ads",
  "meta",
  "microsoft_ads",
  "organic",
  "direct",
  "referral",
] as const;
export type Source = (typeof SOURCES)[number];
export const CHANNELS = ["website", "phone"] as const;
export type Channel = (typeof CHANNELS)[number];

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|search\.brave)\./i;

/** Where a request came from, from its attribution (click ids first, then UTM, then referrer). */
export function sourceOf(a: {
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  utmSource?: string | null;
  referrer?: string | null;
  /** Phone requests: the purpose of the number that was called. */
  phonePurpose?: string | null;
  ownHost?: string | null;
}): Source {
  if (a.gclid || a.gbraid || a.wbraid) return "google_ads";
  if (a.fbclid) return "meta";
  if (a.msclkid) return "microsoft_ads";
  const utm = (a.utmSource ?? "").toLowerCase();
  if (/google/.test(utm)) return "google_ads";
  if (/facebook|meta|instagram|^fb$|^ig$/.test(utm)) return "meta";
  if (/bing|microsoft/.test(utm)) return "microsoft_ads";
  if (utm) return "referral";
  switch (a.phonePurpose) {
    case "google_ads":
      return "google_ads";
    case "meta":
      return "meta";
    case "microsoft":
      return "microsoft_ads";
    case "organic":
      return "organic";
  }
  const ref = a.referrer ?? "";
  if (!ref) return "direct";
  try {
    const host = new URL(ref).hostname;
    if (a.ownHost && host.endsWith(a.ownHost)) return "direct";
    return SEARCH.test(`.${host}`) ? "organic" : "referral";
  } catch {
    return "direct";
  }
}

export const channelOf = (c: string | null | undefined): Channel =>
  c === "phone" ? "phone" : "website";
