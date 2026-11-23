import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Server-side conversions (RSOS-031). Google Ads gets a daily offline-conversion file (its API
 * developer token is pending); Meta gets the Conversions API when switched on; Microsoft gets UET
 * events through Google Tag Manager in the browser. The fake records events and sends nothing.
 */

export type ConversionEvent = {
  eventId: string;
  name: string;
  occurredAt: string;
  marketSlug: string;
  service: string | null;
  source: string | null;
  valueCents: number | null;
  fbclid: string | null;
};

export interface MetaConversions {
  readonly mode: "real" | "fake";
  send(events: ConversionEvent[]): Promise<{ ok: boolean; sent: number }>;
}

const META_EVENT: Record<string, string> = {
  request_submitted: "Lead",
  call_qualified: "Contact",
  job_assigned: "Schedule",
  job_completed: "Purchase",
};

/** Meta Conversions API (behind META_CAPI_ENABLED). Event ids dedupe with the browser pixel. */
export function createMetaConversions(
  o: { pixelId: string; token: string; testCode?: string },
  fetchImpl: typeof fetch = fetch,
): MetaConversions {
  return {
    mode: "real",
    async send(events) {
      const data = events
        .filter((e) => META_EVENT[e.name])
        .map((e) => ({
          event_name: META_EVENT[e.name],
          event_time: Math.floor(Date.parse(e.occurredAt) / 1000),
          event_id: e.eventId,
          action_source: e.name.startsWith("call") ? "phone_call" : "website",
          user_data: e.fbclid
            ? { fbc: `fb.1.${Date.parse(e.occurredAt)}.${e.fbclid}` }
            : { external_id: [createHash("sha256").update(e.eventId).digest("hex")] },
          custom_data: {
            market: e.marketSlug,
            service: e.service ?? undefined,
            ...(e.valueCents !== null ? { value: e.valueCents / 100, currency: "USD" } : {}),
          },
        }));
      if (data.length === 0) return { ok: true, sent: 0 };
      try {
        const res = await fetchImpl(
          `https://graph.facebook.com/v21.0/${o.pixelId}/events?access_token=${encodeURIComponent(o.token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data, ...(o.testCode ? { test_event_code: o.testCode } : {}) }),
            signal: AbortSignal.timeout(10_000),
          },
        );
        const body = z.object({ events_received: z.number() }).safeParse(await res.json());
        return { ok: res.ok && body.success, sent: body.success ? body.data.events_received : 0 };
      } catch {
        return { ok: false, sent: 0 };
      }
    },
  };
}

export function createFakeMetaConversions(): MetaConversions & { sent: ConversionEvent[] } {
  const sent: ConversionEvent[] = [];
  return {
    mode: "fake",
    sent,
    async send(events) {
      sent.push(...events);
      return { ok: true, sent: events.length };
    },
  };
}

export function chooseMetaConversions(
  env: Record<string, string | undefined> = process.env,
): MetaConversions {
  return env.META_CAPI_ENABLED === "true" && env.NEXT_PUBLIC_META_PIXEL_ID && env.META_CAPI_TOKEN
    ? createMetaConversions({
        pixelId: env.NEXT_PUBLIC_META_PIXEL_ID,
        token: env.META_CAPI_TOKEN,
        testCode: env.META_CAPI_TEST_CODE,
      })
    : createFakeMetaConversions();
}

/** Google Ads offline conversions: the "Google Click ID" upload template (one row per gclid). */
export function googleAdsOfflineCsv(
  rows: { gclid: string; name: string; occurredAt: string; valueCents: number | null }[],
): string {
  const time = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+0000`;
  };
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
    ...rows
      .filter((r) => /^[A-Za-z0-9_-]{10,200}$/.test(r.gclid))
      .map((r) =>
        [
          cell(r.gclid),
          cell(r.name),
          time(r.occurredAt),
          r.valueCents !== null ? (r.valueCents / 100).toFixed(2) : "",
          r.valueCents !== null ? "USD" : "",
        ].join(","),
      ),
  ];
  return `${lines.join("\n")}\n`;
}
