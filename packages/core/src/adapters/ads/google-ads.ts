import { z } from "zod";
import type { AdsAdapter, Conversion, SpendRow } from "./types";

/**
 * Google Ads (RSOS-107) over the REST API: GAQL search for spend, uploadClickConversions for
 * offline conversions (gclid, gbraid or wbraid; hashed phone for enhanced conversions when the
 * customer consented; order id = our event id, so a repeat is deduplicated by Google), and
 * campaign status mutations for auto-pause. Off unless every GOOGLE_ADS_* key is set.
 */
export type GoogleAdsConfig = {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  loginCustomerId: string;
  customerId: string;
  /** Our event name to the Google conversion action id. */
  conversionActions: Record<string, string>;
  apiVersion?: string;
};

const Token = z.object({ access_token: z.string() });
const Search = z.array(
  z.object({
    results: z
      .array(
        z.object({
          campaign: z.object({ id: z.string(), name: z.string() }).optional(),
          segments: z.object({ date: z.string() }).optional(),
          metrics: z
            .object({
              costMicros: z.coerce.number().optional(),
              impressions: z.coerce.number().optional(),
              clicks: z.coerce.number().optional(),
            })
            .optional(),
          customer: z.object({ descriptiveName: z.string().optional() }).optional(),
        }),
      )
      .optional(),
  }),
);

export function createGoogleAds(c: GoogleAdsConfig, fetchImpl: typeof fetch = fetch): AdsAdapter {
  const base = `https://googleads.googleapis.com/${c.apiVersion ?? "v19"}/customers/${c.customerId.replace(/-/g, "")}`;
  const cid = c.customerId.replace(/-/g, "");
  const token = async () => {
    const res = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: c.clientId,
        client_secret: c.clientSecret,
        refresh_token: c.refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`google oauth ${res.status}`);
    return Token.parse(await res.json()).access_token;
  };
  const call = async (path: string, body: unknown) => {
    const res = await fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token()}`,
        "developer-token": c.developerToken,
        "login-customer-id": c.loginCustomerId.replace(/-/g, ""),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`google ads ${res.status}`);
    return json;
  };
  const time = (iso: string) => `${iso.slice(0, 19).replace("T", " ")}+00:00`;
  return {
    platform: "google_ads",
    mode: "real",
    async testConnection() {
      try {
        const out = Search.parse(
          await call("/googleAds:searchStream", {
            query: "SELECT customer.descriptive_name FROM customer",
          }),
        );
        return { ok: true, accountName: out[0]?.results?.[0]?.customer?.descriptiveName ?? cid };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "error" };
      }
    },
    async fetchSpend(from, to) {
      const out = Search.parse(
        await call("/googleAds:searchStream", {
          query: `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`,
        }),
      );
      const rows: SpendRow[] = [];
      for (const batch of out)
        for (const r of batch.results ?? [])
          if (r.campaign && r.segments)
            rows.push({
              day: r.segments.date,
              campaignId: r.campaign.id,
              campaignName: r.campaign.name,
              spendCents: Math.round((r.metrics?.costMicros ?? 0) / 10_000),
              impressions: r.metrics?.impressions ?? 0,
              clicks: r.metrics?.clicks ?? 0,
            });
      return rows;
    },
    async uploadConversions(events: Conversion[]) {
      const usable = events.filter(
        (e) => (e.gclid || e.gbraid || e.wbraid) && c.conversionActions[e.name],
      );
      if (!usable.length) return { accepted: [], failed: [], response: null };
      const response = await call(":uploadClickConversions", {
        partialFailure: true,
        conversions: usable.map((e) => ({
          ...(e.gclid
            ? { gclid: e.gclid }
            : e.gbraid
              ? { gbraid: e.gbraid }
              : { wbraid: e.wbraid }),
          conversionAction: `customers/${cid}/conversionActions/${c.conversionActions[e.name]}`,
          conversionDateTime: time(e.occurredAt),
          ...(e.valueCents ? { conversionValue: e.valueCents / 100, currencyCode: "USD" } : {}),
          orderId: e.eventId,
          ...(e.phoneHash ? { userIdentifiers: [{ hashedPhoneNumber: e.phoneHash }] } : {}),
        })),
      });
      // With partial failure, failed rows are listed by index in partialFailureError.details.
      const failedIdx = new Set<number>();
      const pf = z
        .object({ partialFailureError: z.object({ message: z.string().optional() }).optional() })
        .safeParse(response);
      const msg = pf.success ? (pf.data.partialFailureError?.message ?? "") : "";
      for (const m of msg.matchAll(/conversions\[(\d+)\]/g)) failedIdx.add(Number(m[1]));
      return {
        accepted: usable.filter((_, i) => !failedIdx.has(i)).map((e) => e.eventId),
        failed: usable
          .filter((_, i) => failedIdx.has(i))
          .map((e) => ({ eventId: e.eventId, error: "google: partial failure" })),
        response,
      };
    },
    async setCampaignsPaused(ids, paused) {
      if (!ids.length) return { changed: [] };
      await call("/campaigns:mutate", {
        operations: ids.map((id) => ({
          update: {
            resourceName: `customers/${cid}/campaigns/${id}`,
            status: paused ? "PAUSED" : "ENABLED",
          },
          updateMask: "status",
        })),
      });
      return { changed: ids };
    },
  };
}
