import { z } from "zod";
import type { AdsAdapter, Conversion, SpendRow } from "./types";

/**
 * Meta (RSOS-107) over the Graph API: campaign insights for spend, the Conversions API for
 * events (event id = our event id, so Meta deduplicates against the browser Pixel), and campaign
 * status for auto-pause. Off unless META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID and the pixel id
 * are set. META_CAPI_TEST_EVENT_CODE (staging only) sends to Meta's test events tab.
 */
export type MetaAdsConfig = {
  token: string;
  adAccountId: string;
  pixelId: string;
  testEventCode?: string;
  apiVersion?: string;
};

const META_EVENT: Record<string, string> = {
  call_qualified: "Contact",
  request_submitted: "Lead",
  job_assigned: "Schedule",
  job_completed: "Purchase",
};

const Insights = z.object({
  data: z.array(
    z.object({
      campaign_id: z.string(),
      campaign_name: z.string(),
      date_start: z.string(),
      spend: z.coerce.number(),
      impressions: z.coerce.number(),
      clicks: z.coerce.number(),
    }),
  ),
  paging: z.object({ next: z.string().optional() }).optional(),
});

export function createMetaAds(c: MetaAdsConfig, fetchImpl: typeof fetch = fetch): AdsAdapter {
  const base = `https://graph.facebook.com/${c.apiVersion ?? "v21.0"}`;
  const act = c.adAccountId.startsWith("act_") ? c.adAccountId : `act_${c.adAccountId}`;
  const get = async (url: string) => {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${c.token}` } });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`meta ${res.status}`);
    return json;
  };
  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`meta ${res.status}`);
    return json;
  };
  return {
    platform: "meta",
    mode: "real",
    async testConnection() {
      try {
        const out = z.object({ name: z.string() }).parse(await get(`${base}/${act}?fields=name`));
        return { ok: true, accountName: out.name };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "error" };
      }
    },
    async fetchSpend(from, to) {
      const rows: SpendRow[] = [];
      let url: string | undefined =
        `${base}/${act}/insights?level=campaign&time_increment=1&fields=campaign_id,campaign_name,spend,impressions,clicks&time_range=${encodeURIComponent(JSON.stringify({ since: from, until: to }))}&limit=500`;
      for (let page = 0; url && page < 20; page++) {
        const out = Insights.parse(await get(url));
        for (const r of out.data)
          rows.push({
            day: r.date_start,
            campaignId: r.campaign_id,
            campaignName: r.campaign_name,
            spendCents: Math.round(r.spend * 100),
            impressions: r.impressions,
            clicks: r.clicks,
          });
        url = out.paging?.next;
      }
      return rows;
    },
    async uploadConversions(events: Conversion[]) {
      if (!events.length) return { accepted: [], failed: [], response: null };
      const response = await post(`/${c.pixelId}/events`, {
        data: events.map((e) => ({
          event_name: META_EVENT[e.name] ?? e.name,
          event_time: Math.floor(Date.parse(e.occurredAt) / 1000),
          event_id: e.eventId,
          action_source: "website",
          user_data: {
            ...(e.fbclid ? { fbc: `fb.1.${Date.parse(e.occurredAt)}.${e.fbclid}` } : {}),
            ...(e.phoneHash ? { ph: [e.phoneHash] } : {}),
          },
          ...(e.valueCents ? { custom_data: { value: e.valueCents / 100, currency: "USD" } } : {}),
        })),
        ...(c.testEventCode ? { test_event_code: c.testEventCode } : {}),
      });
      const received = z.object({ events_received: z.number() }).safeParse(response);
      const ok = received.success && received.data.events_received === events.length;
      return {
        accepted: ok ? events.map((e) => e.eventId) : [],
        failed: ok
          ? []
          : events.map((e) => ({ eventId: e.eventId, error: "meta: not all received" })),
        response,
      };
    },
    async setCampaignsPaused(ids, paused) {
      for (const id of ids) await post(`/${id}`, { status: paused ? "PAUSED" : "ACTIVE" });
      return { changed: ids };
    },
  };
}
