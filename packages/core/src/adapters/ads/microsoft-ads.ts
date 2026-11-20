import { z } from "zod";
import type { AdsAdapter, Conversion } from "./types";

/**
 * Microsoft Advertising (RSOS-107) over its JSON API (v13): offline conversions by msclkid and
 * campaign status for auto-pause. Spend is reported by Microsoft only as zipped report files; until
 * that import is built, Microsoft spend comes from the manual spend form (fetchSpend says so). Off
 * unless every MS_ADS_* key is set.
 */
export type MicrosoftAdsConfig = {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountId: string;
  customerId: string;
};

export class NotSupportedError extends Error {}

const Token = z.object({ access_token: z.string() });
const CONVERSION_NAME: Record<string, string> = {
  call_qualified: "call_qualified",
  request_submitted: "request_submitted",
  job_assigned: "job_assigned",
  job_completed: "job_completed",
};

export function createMicrosoftAds(
  c: MicrosoftAdsConfig,
  fetchImpl: typeof fetch = fetch,
): AdsAdapter {
  const base = "https://campaign.api.bingads.microsoft.com/CampaignManagement/v13";
  const token = async () => {
    const res = await fetchImpl("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: c.clientId,
        client_secret: c.clientSecret,
        refresh_token: c.refreshToken,
        scope: "https://ads.microsoft.com/msads.manage offline_access",
      }),
    });
    if (!res.ok) throw new Error(`microsoft oauth ${res.status}`);
    return Token.parse(await res.json()).access_token;
  };
  const call = async (path: string, body: unknown, method = "POST") => {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await token()}`,
        DeveloperToken: c.developerToken,
        CustomerId: c.customerId,
        CustomerAccountId: c.accountId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`microsoft ads ${res.status}`);
    return json;
  };
  return {
    platform: "microsoft_ads",
    mode: "real",
    async testConnection() {
      try {
        await call("/Campaigns/QueryByAccountId", {
          AccountId: c.accountId,
          CampaignType: "Search",
        });
        return { ok: true, accountName: `Account ${c.accountId}` };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "error" };
      }
    },
    async fetchSpend() {
      throw new NotSupportedError(
        "microsoft spend import is not built yet: use the manual spend form",
      );
    },
    async uploadConversions(events: Conversion[]) {
      const usable = events.filter((e) => e.msclkid);
      if (!usable.length) return { accepted: [], failed: [], response: null };
      const response = await call("/OfflineConversions/Apply", {
        OfflineConversions: usable.map((e) => ({
          MicrosoftClickId: e.msclkid,
          ConversionName: CONVERSION_NAME[e.name],
          ConversionTime: e.occurredAt,
          ConversionValue: e.valueCents ? e.valueCents / 100 : null,
          ConversionCurrencyCode: "USD",
        })),
      });
      const errs = z
        .object({
          PartialErrors: z
            .array(z.object({ Index: z.number() }))
            .nullable()
            .optional(),
        })
        .safeParse(response);
      const bad = new Set(
        (errs.success ? (errs.data.PartialErrors ?? []) : []).map((p) => p.Index),
      );
      return {
        accepted: usable.filter((_, i) => !bad.has(i)).map((e) => e.eventId),
        failed: usable
          .filter((_, i) => bad.has(i))
          .map((e) => ({ eventId: e.eventId, error: "microsoft: partial error" })),
        response,
      };
    },
    async setCampaignsPaused(ids, paused) {
      if (!ids.length) return { changed: [] };
      await call(
        "/Campaigns",
        {
          AccountId: c.accountId,
          Campaigns: ids.map((id) => ({ Id: id, Status: paused ? "Paused" : "Active" })),
        },
        "PUT",
      );
      return { changed: ids };
    },
  };
}
