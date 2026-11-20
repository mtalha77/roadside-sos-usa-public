import { z } from "zod";
import { createGoogleAds } from "./google-ads";
import { createMetaAds } from "./meta";
import { createMicrosoftAds } from "./microsoft-ads";
import { type AdPlatform, type AdsAdapter, hasKeys } from "./types";

/**
 * The real adapter for a platform, or null when it is not connected: its keys are missing from the
 * server environment or its switch in Admin > Marketing > Connections is off. Nothing is faked
 * outside tests: without keys the platform is simply "Not connected".
 */
export function chooseAds(
  platform: AdPlatform,
  enabled: boolean,
  env: Record<string, string | undefined> = process.env,
): AdsAdapter | null {
  if (!enabled || !hasKeys(platform, env)) return null;
  if (platform === "google_ads") {
    const actions = z.record(z.string(), z.string()).safeParse(
      (() => {
        try {
          return JSON.parse(env.GOOGLE_ADS_CONVERSION_ACTION_IDS ?? "{}");
        } catch {
          return {};
        }
      })(),
    );
    return createGoogleAds({
      developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      clientId: env.GOOGLE_ADS_CLIENT_ID!,
      clientSecret: env.GOOGLE_ADS_CLIENT_SECRET!,
      refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN!,
      loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!,
      customerId: env.GOOGLE_ADS_CUSTOMER_ID!,
      conversionActions: actions.success ? actions.data : {},
      apiVersion: env.GOOGLE_ADS_API_VERSION,
    });
  }
  if (platform === "meta")
    return createMetaAds({
      token: env.META_SYSTEM_USER_TOKEN!,
      adAccountId: env.META_AD_ACCOUNT_ID!,
      pixelId: env.NEXT_PUBLIC_META_PIXEL_ID!,
      testEventCode: env.META_CAPI_TEST_EVENT_CODE,
    });
  return createMicrosoftAds({
    developerToken: env.MS_ADS_DEVELOPER_TOKEN!,
    clientId: env.MS_ADS_CLIENT_ID!,
    clientSecret: env.MS_ADS_CLIENT_SECRET!,
    refreshToken: env.MS_ADS_REFRESH_TOKEN!,
    accountId: env.MS_ADS_ACCOUNT_ID!,
    customerId: env.MS_ADS_CUSTOMER_ID!,
  });
}

/** Connection status for the Connections page, without ever exposing key values. */
export function connectionStatus(
  platform: AdPlatform,
  enabled: boolean,
  lastError: string | null,
  env: Record<string, string | undefined> = process.env,
): "not_connected" | "off" | "connected" | "error" {
  if (!hasKeys(platform, env)) return "not_connected";
  if (!enabled) return "off";
  return lastError ? "error" : "connected";
}
