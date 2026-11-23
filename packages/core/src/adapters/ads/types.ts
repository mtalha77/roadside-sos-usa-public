import { z } from "zod";

/**
 * Ad platform adapters (RSOS-107): spend import, conversion upload and campaign pausing for Google
 * Ads, Meta and Microsoft Ads. Each has a real implementation (on only with its keys in the server
 * environment and its switch on in Admin > Marketing > Connections) and a fake for tests.
 */
export const AD_PLATFORMS = ["google_ads", "meta", "microsoft_ads"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

/** Our conversion events, in funnel order (RSOS-031, RSOS-111). */
export const AD_EVENTS = [
  "call_qualified",
  "request_submitted",
  "job_assigned",
  "job_completed",
] as const;
export type AdEvent = (typeof AD_EVENTS)[number];

export const SpendRow = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaignId: z.string().min(1).max(64),
  campaignName: z.string().max(255),
  spendCents: z.number().int().min(0),
  impressions: z.number().int().min(0),
  clicks: z.number().int().min(0),
});
export type SpendRow = z.infer<typeof SpendRow>;

export type Conversion = {
  /** Our event id ("request_submitted:<request id>"), the idempotency key on every platform. */
  eventId: string;
  name: AdEvent;
  occurredAt: string;
  valueCents: number | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  msclkid?: string | null;
  /** SHA-256 of the E.164 phone, only when the customer's consent allows enhanced conversions. */
  phoneHash?: string | null;
};

export type UploadResult = {
  accepted: string[];
  failed: { eventId: string; error: string }[];
  /** The platform's raw response, kept in the upload log (never keys). */
  response: unknown;
};

export type ConnectionTest = { ok: true; accountName: string } | { ok: false; error: string };

export interface AdsAdapter {
  readonly platform: AdPlatform;
  readonly mode: "real" | "fake";
  testConnection(): Promise<ConnectionTest>;
  fetchSpend(from: string, to: string): Promise<SpendRow[]>;
  uploadConversions(events: Conversion[]): Promise<UploadResult>;
  setCampaignsPaused(campaignIds: string[], paused: boolean): Promise<{ changed: string[] }>;
}

/** Server variables each platform needs (names only; values are never read into the browser). */
export const AD_KEYS: Record<AdPlatform, readonly string[]> = {
  google_ads: [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_CONVERSION_ACTION_IDS",
  ],
  meta: ["META_SYSTEM_USER_TOKEN", "META_AD_ACCOUNT_ID", "NEXT_PUBLIC_META_PIXEL_ID"],
  microsoft_ads: [
    "MS_ADS_DEVELOPER_TOKEN",
    "MS_ADS_CLIENT_ID",
    "MS_ADS_CLIENT_SECRET",
    "MS_ADS_REFRESH_TOKEN",
    "MS_ADS_ACCOUNT_ID",
    "MS_ADS_CUSTOMER_ID",
  ],
};

export const hasKeys = (p: AdPlatform, env: Record<string, string | undefined>) =>
  AD_KEYS[p].every((k) => Boolean(env[k]));
