import { describe, expect, it } from "vitest";
import {
  autoPause,
  backoffMs,
  chooseAds,
  connectionStatus,
  type Conversion,
  createFakeAds,
  createGoogleAds,
  createMetaAds,
  createMicrosoftAds,
  dashboardRow,
  dueUploads,
  effectiveSpend,
  mapCampaign,
  NotSupportedError,
  syncHealth,
  unusual,
  type UploadLog,
} from "../src/adapters/ads";

// RSOS-107: automatic ad sync, end to end with fakes. Markets are A and B (fictional ids).
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const services = [
  { slug: "tow", name: "Tow" },
  { slug: "flat-tire", name: "Flat tire" },
];
const marketCodes = { MA: A, MB: B };
const NOW = Date.UTC(2026, 10, 19, 15);

describe("connections", () => {
  it("without keys a platform is not connected and nothing is created", () => {
    expect(chooseAds("google_ads", true, {})).toBeNull();
    expect(chooseAds("meta", true, {})).toBeNull();
    expect(connectionStatus("meta", true, null, {})).toBe("not_connected");
  });
  it("with keys but the switch off, it stays off", () => {
    const env = {
      META_SYSTEM_USER_TOKEN: "x",
      META_AD_ACCOUNT_ID: "1",
      NEXT_PUBLIC_META_PIXEL_ID: "2",
    };
    expect(chooseAds("meta", false, env)).toBeNull();
    expect(connectionStatus("meta", false, null, env)).toBe("off");
    expect(chooseAds("meta", true, env)?.mode).toBe("real");
    expect(connectionStatus("meta", true, "meta 401", env)).toBe("error");
  });
});

describe("spend import", () => {
  it("maps campaigns by the naming rule, a manual mapping wins, and imports beat manual spend", async () => {
    const fake = createFakeAds("google_ads", {
      campaigns: [
        { id: "c1", name: "MA | Tow | Search" },
        { id: "c2", name: "MB | Flat tire | Search" },
        { id: "c3", name: "Brand awareness" },
      ],
    });
    const rows = await fake.fetchSpend("2026-11-17", "2026-11-18");
    expect(rows).toHaveLength(6);
    const mapped = rows.flatMap((r) => {
      const m = mapCampaign(r.campaignName, {
        marketCodes,
        services,
        manual: r.campaignId === "c3" ? { marketId: A, service: null } : null,
      });
      return m
        ? [
            {
              day: r.day,
              marketId: m.marketId,
              channel: "google_ads" as const,
              spendCents: r.spendCents,
            },
          ]
        : [];
    });
    expect(mapCampaign("MB | Flat tire | Search", { marketCodes, services })).toEqual({
      marketId: B,
      service: "flat-tire",
    });
    expect(mapCampaign("Unknown | Tow", { marketCodes, services })).toBeNull();
    const spend = effectiveSpend(mapped, [
      { day: "2026-11-17", marketId: A, channel: "google_ads", spendCents: 99_999 },
      { day: "2026-11-16", marketId: A, channel: "google_ads", spendCents: 5_000 },
    ]);
    // Day 17, market A: imported c1 (1,000) + c3 (1,200) wins over the manual 99,999.
    expect(spend.find((s) => s.day === "2026-11-17" && s.marketId === A)).toMatchObject({
      spendCents: 2_200,
      source: "imported",
    });
    // Day 16 has no import: the manual entry fills it.
    expect(spend.find((s) => s.day === "2026-11-16")).toMatchObject({
      spendCents: 5_000,
      source: "manual",
    });
  });
});

describe("conversion upload", () => {
  const events: Conversion[] = [
    {
      eventId: "request_submitted:r1",
      name: "request_submitted",
      occurredAt: "2026-11-19T10:00:00Z",
      valueCents: null,
      gclid: "g1",
    },
    {
      eventId: "job_completed:r1",
      name: "job_completed",
      occurredAt: "2026-11-19T12:00:00Z",
      valueCents: 12_500,
      gclid: "g1",
    },
    {
      eventId: "request_submitted:r2",
      name: "request_submitted",
      occurredAt: "2026-11-19T10:05:00Z",
      valueCents: null,
      fbclid: "f2",
    },
    {
      eventId: "request_submitted:r3",
      name: "request_submitted",
      occurredAt: "2026-11-19T10:06:00Z",
      valueCents: null,
    },
  ];

  it("goes to the platform that produced the click, once (idempotent), and retries failures with backoff", async () => {
    const google = createFakeAds("google_ads", {
      campaigns: [],
      reject: new Set(["job_completed:r1"]),
    });
    const meta = createFakeAds("meta", { campaigns: [] });
    const log: UploadLog[] = [];
    const run = async (now: number) => {
      for (const [platform, list] of dueUploads(events, log, now)) {
        const adapter = platform === "google_ads" ? google : meta;
        const res = await adapter.uploadConversions(list);
        for (const id of res.accepted)
          log.push({ eventId: id, platform, status: "sent", attempts: 1, nextAttemptAt: null });
        for (const f of res.failed) {
          const prev = log.find((l) => l.eventId === f.eventId && l.platform === platform);
          const attempts = (prev?.attempts ?? 0) + 1;
          if (prev) Object.assign(prev, { attempts, nextAttemptAt: now + backoffMs(attempts) });
          else
            log.push({
              eventId: f.eventId,
              platform,
              status: "failed",
              attempts,
              nextAttemptAt: now + backoffMs(attempts),
            });
        }
      }
    };
    await run(NOW);
    expect([...google.uploaded.keys()]).toEqual(["request_submitted:r1"]);
    expect([...meta.uploaded.keys()]).toEqual(["request_submitted:r2"]);
    // r3 has no click id: no platform gets it.
    // Second run right away: nothing new is sent (idempotent), the failure waits for its backoff.
    const calls = google.calls.upload + meta.calls.upload;
    await run(NOW + 1000);
    expect(google.calls.upload + meta.calls.upload).toBe(calls);
    // After the backoff, the failed one is retried; once the platform accepts it, it is done.
    google.uploaded.clear();
    const fixed = createFakeAds("google_ads", { campaigns: [] });
    const due = dueUploads(events, log, NOW + backoffMs(1) + 1);
    expect(due.get("google_ads")?.map((e) => e.eventId)).toEqual(["job_completed:r1"]);
    expect((await fixed.uploadConversions(due.get("google_ads")!)).accepted).toEqual([
      "job_completed:r1",
    ]);
    expect(backoffMs(1)).toBe(300_000);
    expect(backoffMs(20)).toBe(86_400_000);
  });
});

describe("auto-pause safety", () => {
  const rule = { enabled: true, minProviders: 1, graceMinutes: 10, startHour: 6, endHour: 22 };
  it("pauses a service's campaigns after the grace period with nobody online, and resumes when back", async () => {
    const fake = createFakeAds("google_ads", {
      campaigns: [{ id: "c1", name: "MA | Tow | Search" }],
    });
    let state = { pausedServices: [] as string[], shortSince: {} as Record<string, number> };
    // 0 providers for Tow at 10:00: within the grace period, nothing yet.
    let out = autoPause(rule, { tow: 0, "flat-tire": 2 }, ["tow", "flat-tire"], state, NOW, 10);
    expect(out.pause).toEqual([]);
    state = out.state;
    // 11 minutes later: paused.
    out = autoPause(
      rule,
      { tow: 0, "flat-tire": 2 },
      ["tow", "flat-tire"],
      state,
      NOW + 11 * 60_000,
      10,
    );
    expect(out.pause).toEqual(["tow"]);
    await fake.setCampaignsPaused(["c1"], true);
    expect(fake.paused.has("c1")).toBe(true);
    state = out.state;
    // A provider comes back online: resumed.
    out = autoPause(
      rule,
      { tow: 1, "flat-tire": 2 },
      ["tow", "flat-tire"],
      state,
      NOW + 20 * 60_000,
      10,
    );
    expect(out.resume).toEqual(["tow"]);
    await fake.setCampaignsPaused(["c1"], false);
    expect(fake.paused.has("c1")).toBe(false);
  });
  it("does nothing outside ad hours or when the rule is off (the default)", () => {
    const state = { pausedServices: [], shortSince: { tow: NOW - 3_600_000 } };
    expect(autoPause(rule, { tow: 0 }, ["tow"], state, NOW, 23).pause).toEqual([]);
    expect(
      autoPause({ ...rule, enabled: false }, { tow: 0 }, ["tow"], state, NOW, 10).pause,
    ).toEqual([]);
  });
});

describe("dashboard, daily email and sync health", () => {
  it("computes cost per request, cost per completed job and return on ad spend", () => {
    expect(
      dashboardRow({
        spendCents: 40_000,
        clicks: 80,
        calls: 10,
        qualifiedCalls: 6,
        requests: 20,
        assigned: 12,
        completed: 10,
        feesCents: 32_500,
      }),
    ).toMatchObject({ costPerRequestCents: 2_000, costPerCompletedCents: 4_000, roas: 0.8125 });
    expect(
      dashboardRow({
        spendCents: 0,
        clicks: 0,
        calls: 0,
        qualifiedCalls: 0,
        requests: 0,
        assigned: 0,
        completed: 0,
        feesCents: 0,
      }),
    ).toMatchObject({
      costPerRequestCents: null,
      costPerCompletedCents: null,
      roas: null,
    });
  });
  it("flags spend with zero requests, a high cost per job and failed syncs", () => {
    const base = { clicks: 0, calls: 0, qualifiedCalls: 0, assigned: 0, feesCents: 0 };
    expect(
      unusual(
        [
          { marketId: A, spendCents: 5_000, requests: 0, completed: 0, ...base },
          { marketId: B, spendCents: 50_000, requests: 5, completed: 1, ...base },
        ],
        { maxCostPerCompletedCents: 15_000, failedJobs: ["spend:meta"] },
      ),
    ).toEqual([
      { kind: "spend_no_requests", marketId: A },
      { kind: "cost_per_job", marketId: B },
      { kind: "failed_sync", job: "spend:meta" },
    ]);
  });
  it("alerts after 3 consecutive failures", () => {
    const runs = [
      { job: "spend:google_ads", ok: false, at: 5 },
      { job: "spend:google_ads", ok: false, at: 4 },
      { job: "spend:google_ads", ok: false, at: 3 },
      { job: "spend:google_ads", ok: true, at: 2 },
      { job: "conversions:meta", ok: false, at: 5 },
      { job: "conversions:meta", ok: true, at: 4 },
    ];
    expect(syncHealth(runs)).toEqual([
      { job: "spend:google_ads", lastOk: 2, failures: 3, alert: true },
      { job: "conversions:meta", lastOk: 4, failures: 1, alert: false },
    ]);
  });
});

describe("real adapters (network stubbed)", () => {
  const stub = (responses: Record<string, unknown>) => {
    const seen: { url: string; body: string }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), body: String(init?.body ?? "") });
      const key = Object.keys(responses).find((k) => String(url).includes(k));
      return new Response(JSON.stringify(key ? responses[key] : {}), { status: 200 });
    }) as unknown as typeof fetch;
    return { f, seen };
  };

  it("Google Ads: spend from GAQL in cents, uploads with the event id as the order id", async () => {
    const { f, seen } = stub({
      "oauth2.googleapis.com": { access_token: "t" },
      searchStream: [
        {
          results: [
            {
              campaign: { id: "9", name: "MA | Tow | Search" },
              segments: { date: "2026-11-18" },
              metrics: { costMicros: "12345678", impressions: "100", clicks: "7" },
            },
          ],
        },
      ],
      uploadClickConversions: {},
    });
    const g = createGoogleAds(
      {
        developerToken: "d",
        clientId: "c",
        clientSecret: "s",
        refreshToken: "r",
        loginCustomerId: "111-222-3333",
        customerId: "444-555-6666",
        conversionActions: { request_submitted: "77" },
      },
      f,
    );
    expect(await g.fetchSpend("2026-11-18", "2026-11-18")).toEqual([
      {
        day: "2026-11-18",
        campaignId: "9",
        campaignName: "MA | Tow | Search",
        spendCents: 1235,
        impressions: 100,
        clicks: 7,
      },
    ]);
    const res = await g.uploadConversions([
      {
        eventId: "request_submitted:r1",
        name: "request_submitted",
        occurredAt: "2026-11-19T10:00:00Z",
        valueCents: null,
        gclid: "g1",
      },
    ]);
    expect(res.accepted).toEqual(["request_submitted:r1"]);
    const body = JSON.parse(seen.at(-1)!.body);
    expect(body.conversions[0]).toMatchObject({
      gclid: "g1",
      orderId: "request_submitted:r1",
      conversionAction: "customers/4445556666/conversionActions/77",
    });
  });

  it("Meta: Conversions API with our event id for deduplication", async () => {
    const { f, seen } = stub({ "/events": { events_received: 1 } });
    const m = createMetaAds({ token: "t", adAccountId: "1", pixelId: "2" }, f);
    const res = await m.uploadConversions([
      {
        eventId: "request_submitted:r2",
        name: "request_submitted",
        occurredAt: "2026-11-19T10:05:00Z",
        valueCents: null,
        fbclid: "f2",
      },
    ]);
    expect(res.accepted).toEqual(["request_submitted:r2"]);
    expect(JSON.parse(seen[0]!.body).data[0]).toMatchObject({
      event_name: "Lead",
      event_id: "request_submitted:r2",
    });
  });

  it("Microsoft: offline conversions by msclkid; spend import says it is not built yet", async () => {
    const { f } = stub({
      "microsoftonline.com": { access_token: "t" },
      OfflineConversions: { PartialErrors: null },
    });
    const ms = createMicrosoftAds(
      {
        developerToken: "d",
        clientId: "c",
        clientSecret: "s",
        refreshToken: "r",
        accountId: "1",
        customerId: "2",
      },
      f,
    );
    await expect(ms.fetchSpend("2026-11-18", "2026-11-18")).rejects.toBeInstanceOf(
      NotSupportedError,
    );
    const res = await ms.uploadConversions([
      {
        eventId: "job_assigned:r4",
        name: "job_assigned",
        occurredAt: "2026-11-19T10:05:00Z",
        valueCents: 9_000,
        msclkid: "m4",
      },
    ]);
    expect(res.accepted).toEqual(["job_assigned:r4"]);
  });
});
