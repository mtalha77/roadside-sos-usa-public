import { describe, expect, it } from "vitest";
import {
  chooseMetaConversions,
  createFakeMetaConversions,
  createMetaConversions,
  googleAdsOfflineCsv,
} from "../src/adapters";

const ev = (name: string, extra: Partial<{ fbclid: string; valueCents: number }> = {}) => ({
  eventId: `${name}:1`,
  name,
  occurredAt: "2026-11-16T14:03:05.000Z",
  marketSlug: "test-market",
  service: "tow",
  source: "google_ads",
  valueCents: extra.valueCents ?? null,
  fbclid: extra.fbclid ?? null,
});

describe("Google Ads offline conversions", () => {
  it("writes the Google Click ID template with UTC times and skips bad ids", () => {
    const csv = googleAdsOfflineCsv([
      {
        gclid: "TEST-GCLID-0001",
        name: "request_submitted",
        occurredAt: "2026-11-16T14:03:05Z",
        valueCents: null,
      },
      {
        gclid: "TEST-GCLID-0002",
        name: "job_completed",
        occurredAt: "2026-11-16T20:00:00Z",
        valueCents: 12500,
      },
      {
        gclid: "bad id!",
        name: "request_submitted",
        occurredAt: "2026-11-16T14:03:05Z",
        valueCents: null,
      },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
    );
    expect(lines[1]).toBe("TEST-GCLID-0001,request_submitted,2026-11-16 14:03:05+0000,,");
    expect(lines[2]).toBe("TEST-GCLID-0002,job_completed,2026-11-16 20:00:00+0000,125.00,USD");
    expect(lines).toHaveLength(3);
  });
});

describe("Meta Conversions API", () => {
  it("is fake unless switched on with a pixel and token", () => {
    expect(chooseMetaConversions({}).mode).toBe("fake");
    expect(
      chooseMetaConversions({
        META_CAPI_ENABLED: "true",
        NEXT_PUBLIC_META_PIXEL_ID: "1",
        META_CAPI_TOKEN: "t",
      }).mode,
    ).toBe("real");
  });

  it("maps our events, dedupes with event ids, and reads the response", async () => {
    let body: {
      data: { event_name: string; event_id: string; custom_data: { value?: number } }[];
    } = { data: [] };
    const meta = createMetaConversions({ pixelId: "123", token: "t" }, (async (
      _u: unknown,
      init?: RequestInit,
    ) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ events_received: body.data.length }), { status: 200 });
    }) as unknown as typeof fetch);
    const r = await meta.send([
      ev("request_submitted", { fbclid: "abc" }),
      ev("job_completed", { valueCents: 9900 }),
      ev("call_started"),
    ]);
    expect(r).toEqual({ ok: true, sent: 2 });
    expect(body.data.map((d) => d.event_name)).toEqual(["Lead", "Purchase"]);
    expect(body.data[1]!.custom_data.value).toBe(99);
    expect(await meta.send([ev("call_started")])).toEqual({ ok: true, sent: 0 });
    const down = createMetaConversions({ pixelId: "1", token: "t" }, (async () => {
      throw new Error("down");
    }) as unknown as typeof fetch);
    expect((await down.send([ev("request_submitted")])).ok).toBe(false);
    const fake = createFakeMetaConversions();
    await fake.send([ev("request_submitted")]);
    expect(fake.sent).toHaveLength(1);
  });
});
