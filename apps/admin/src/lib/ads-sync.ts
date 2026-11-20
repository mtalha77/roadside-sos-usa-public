import "server-only";
import { brand } from "@rsos/config/brand";
import {
  AD_PLATFORMS,
  type AdPlatform,
  type AdsAdapter,
  autoPause,
  backoffMs,
  chooseAds,
  type Conversion,
  dueUploads,
  mapCampaign,
  MAX_ATTEMPTS,
  NotSupportedError,
  type PauseState,
  syncHealth,
  type UploadLog,
} from "@rsos/core/ads";
import { createAdminSupabase } from "@rsos/db/admin";
import { AdsNoticeEmail, chooseEmailSender } from "@rsos/emails";
import { fill, getMessages } from "@rsos/i18n";
import { z } from "zod";

/**
 * The ad sync jobs (RSOS-107), run by cron with CRON_SECRET (trusted server code: the admin client).
 * A platform takes part only when its keys exist and its switch is on; otherwise it is skipped and
 * nothing errors. Every run is recorded in sync_runs for System status; after 3 failures in a row
 * the owner is emailed once.
 */
type Admin = ReturnType<typeof createAdminSupabase>;
type Adapters = Partial<Record<AdPlatform, AdsAdapter>>;

export async function connectedAdapters(admin: Admin, override?: Adapters): Promise<Adapters> {
  if (override) return override;
  const { data } = await admin.from("ad_connections").select("platform, enabled");
  const out: Adapters = {};
  for (const p of AD_PLATFORMS) {
    const a = chooseAds(p, Boolean(data?.find((r) => r.platform === p)?.enabled));
    if (a) out[p] = a;
  }
  return out;
}

async function record(admin: Admin, job: string, ok: boolean, details: object, error?: string) {
  await admin
    .from("sync_runs")
    .insert({ job, ok, details: details as never, error: error?.slice(0, 500) ?? null });
  if (ok) return;
  const { data } = await admin
    .from("sync_runs")
    .select("job, ok, started_at")
    .eq("job", job)
    .order("started_at", { ascending: false })
    .limit(5);
  const health = syncHealth(
    (data ?? []).map((r) => ({ job: r.job, ok: r.ok, at: Date.parse(r.started_at) })),
  )[0];
  // Exactly at the third failure in a row: one alert, not one per run.
  if (health?.failures === 3)
    await chooseEmailSender()
      .send({
        to: brand.emails.support,
        subject: fill(M().failingTitle, { job }),
        react: AdsNoticeEmail({
          title: fill(M().failingTitle, { job }),
          lines: [fill(M().failingBody, { error: error ?? "" })],
        }),
        tags: { category: "ads_sync_alert" },
      })
      .catch(() => null);
}

const M = () => getMessages("en").emails.ads;
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Spend import: yesterday and today hourly, the last 7 days nightly (late adjustments). */
export async function importSpend(opts: { days: number; now?: number; adapters?: Adapters }) {
  const admin = createAdminSupabase();
  const now = opts.now ?? Date.now();
  const adapters = await connectedAdapters(admin, opts.adapters);
  const [{ data: markets }, { data: services }, { data: campaigns }] = await Promise.all([
    admin.from("markets").select("id, ad_code"),
    admin.from("services").select("slug, name"),
    admin
      .from("ad_campaigns")
      .select("platform, campaign_id, market_id, service_slug, mapped_by_hand"),
  ]);
  const marketCodes = Object.fromEntries(
    (markets ?? []).flatMap((m) => (m.ad_code ? [[m.ad_code, m.id]] : [])),
  );
  const results: Record<string, number | string> = {};
  for (const [platform, adapter] of Object.entries(adapters) as [AdPlatform, AdsAdapter][]) {
    const job = `spend:${platform}`;
    try {
      const rows = await adapter.fetchSpend(day(now - (opts.days - 1) * 86_400_000), day(now));
      const seen = new Map<
        string,
        { marketId: string | null; service: string | null; name: string }
      >();
      for (const r of rows) {
        if (seen.has(r.campaignId)) continue;
        const known = campaigns?.find(
          (c) => c.platform === platform && c.campaign_id === r.campaignId,
        );
        const m = mapCampaign(r.campaignName, {
          marketCodes,
          services: services ?? [],
          manual:
            known?.mapped_by_hand && known.market_id
              ? { marketId: known.market_id, service: known.service_slug }
              : null,
        });
        seen.set(r.campaignId, {
          marketId: m?.marketId ?? null,
          service: m?.service ?? null,
          name: r.campaignName,
        });
      }
      if (seen.size)
        await admin.from("ad_campaigns").upsert(
          [...seen].map(([id, v]) => ({
            platform,
            campaign_id: id,
            name: v.name,
            market_id: v.marketId,
            service_slug: v.service,
            seen_at: new Date(now).toISOString(),
          })),
          { onConflict: "platform,campaign_id", ignoreDuplicates: false },
        );
      if (rows.length)
        await admin.from("ad_spend_daily").upsert(
          rows.map((r) => ({
            platform,
            campaign_id: r.campaignId,
            day: r.day,
            market_id: seen.get(r.campaignId)?.marketId ?? null,
            service_slug: seen.get(r.campaignId)?.service ?? null,
            spend_cents: r.spendCents,
            impressions: r.impressions,
            clicks: r.clicks,
            imported_at: new Date(now).toISOString(),
          })),
          { onConflict: "platform,campaign_id,day" },
        );
      await admin
        .from("ad_connections")
        .update({ last_sync_at: new Date(now).toISOString(), last_error: null })
        .eq("platform", platform);
      await record(admin, job, true, { rows: rows.length, days: opts.days });
      results[platform] = rows.length;
    } catch (e) {
      // Microsoft spend is not imported yet: that is a known gap, not a failure.
      if (e instanceof NotSupportedError) {
        results[platform] = "manual";
        continue;
      }
      const msg = e instanceof Error ? e.message : "error";
      await admin
        .from("ad_connections")
        .update({ last_error: msg.slice(0, 300) })
        .eq("platform", platform);
      await record(admin, job, false, {}, msg);
      results[platform] = "error";
    }
  }
  return results;
}

const Event = z.object({
  event_id: z.string(),
  name: z.enum(["call_qualified", "request_submitted", "job_assigned", "job_completed"]),
  occurred_at: z.string(),
  value_cents: z.number().nullable(),
  gclid: z.string().nullable(),
  gbraid: z.string().nullable(),
  wbraid: z.string().nullable(),
  fbclid: z.string().nullable(),
  msclkid: z.string().nullable(),
});

/** Conversion upload: every event with a click id back to its platform, once, with retries. */
export async function uploadConversions(opts: { now?: number; adapters?: Adapters } = {}) {
  const admin = createAdminSupabase();
  const now = opts.now ?? Date.now();
  const adapters = await connectedAdapters(admin, opts.adapters);
  if (!Object.keys(adapters).length) return {};
  const [{ data: rows }, { data: log }] = await Promise.all([
    admin
      .from("conversion_events")
      .select("event_id, name, occurred_at, value_cents, gclid, gbraid, wbraid, fbclid, msclkid")
      .in("name", ["call_qualified", "request_submitted", "job_assigned", "job_completed"])
      .gte("occurred_at", new Date(now - 30 * 86_400_000).toISOString())
      .limit(2000),
    admin
      .from("ad_conversion_uploads")
      .select("platform, event_id, status, attempts, next_attempt_at"),
  ]);
  const events: Conversion[] = z
    .array(Event)
    .catch([])
    .parse(rows ?? [])
    .map((e) => ({
      eventId: e.event_id,
      name: e.name,
      occurredAt: e.occurred_at,
      valueCents: e.value_cents,
      gclid: e.gclid,
      gbraid: e.gbraid,
      wbraid: e.wbraid,
      fbclid: e.fbclid,
      msclkid: e.msclkid,
      // Enhanced conversions with a hashed phone wait for an advertising consent (not collected yet).
      phoneHash: null,
    }));
  const uploadLog: UploadLog[] = (log ?? []).map((l) => ({
    eventId: l.event_id,
    platform: l.platform as AdPlatform,
    status: l.status === "sent" ? "sent" : "failed",
    attempts: l.attempts,
    nextAttemptAt: l.next_attempt_at ? Date.parse(l.next_attempt_at) : null,
  }));
  const results: Record<string, { sent: number; failed: number }> = {};
  for (const [platform, list] of dueUploads(events, uploadLog, now)) {
    const adapter = adapters[platform];
    if (!adapter) continue;
    const job = `conversions:${platform}`;
    try {
      const res = await adapter.uploadConversions(list);
      const prev = new Map(
        uploadLog.filter((l) => l.platform === platform).map((l) => [l.eventId, l.attempts]),
      );
      const at = new Date(now).toISOString();
      const upserts = [
        ...res.accepted.map((id) => ({
          platform,
          event_id: id,
          status: "sent",
          attempts: (prev.get(id) ?? 0) + 1,
          last_attempt_at: at,
          next_attempt_at: null,
          response: res.response as never,
        })),
        ...res.failed.map((f) => {
          const attempts = (prev.get(f.eventId) ?? 0) + 1;
          return {
            platform,
            event_id: f.eventId,
            status: "failed",
            attempts,
            last_attempt_at: at,
            next_attempt_at:
              attempts >= MAX_ATTEMPTS ? null : new Date(now + backoffMs(attempts)).toISOString(),
            response: { error: f.error } as never,
          };
        }),
      ];
      if (upserts.length)
        await admin
          .from("ad_conversion_uploads")
          .upsert(upserts, { onConflict: "platform,event_id" });
      await record(admin, job, true, { sent: res.accepted.length, failed: res.failed.length });
      results[platform] = { sent: res.accepted.length, failed: res.failed.length };
    } catch (e) {
      await record(admin, job, false, {}, e instanceof Error ? e.message : "error");
      results[platform] = { sent: 0, failed: list.length };
    }
  }
  return results;
}

const State = z.object({
  pausedServices: z.array(z.string()).default([]),
  shortSince: z.record(z.string(), z.number()).default({}),
});

/** Auto-pause (every 5 minutes): campaigns of a service with nobody available pause, then resume. */
export async function runAutoPause(opts: { now?: number; adapters?: Adapters } = {}) {
  const admin = createAdminSupabase();
  const now = opts.now ?? Date.now();
  const [{ data: rules }, { data: markets }] = await Promise.all([
    admin.from("ad_pause_rules").select("*").eq("enabled", true),
    admin.from("markets").select("id, name, time_zone"),
  ]);
  if (!rules?.length) return { markets: 0 };
  const adapters = await connectedAdapters(admin, opts.adapters);
  const changes: { market: string; pause: string[]; resume: string[] }[] = [];
  for (const rule of rules) {
    const tz = markets?.find((m) => m.id === rule.market_id)?.time_zone ?? "UTC";
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(
        now,
      ),
    );
    // Available providers per service: real, active providers with a price for it (real providers
    // have no online status yet, see docs/runbooks/ads-connections.md).
    const { data: prices } = await admin
      .from("provider_service_prices")
      .select("service_id, provider_id, services(slug), providers!inner(status, is_demo)")
      .eq("market_id", rule.market_id)
      .eq("active", true);
    const online: Record<string, number> = {};
    for (const p of prices ?? []) {
      const prov = p.providers as unknown as { status: string; is_demo: boolean };
      const slug = (p.services as unknown as { slug: string } | null)?.slug;
      if (slug && prov.status === "active" && !prov.is_demo) online[slug] = (online[slug] ?? 0) + 1;
    }
    const { data: tagged } = await admin
      .from("ad_campaigns")
      .select("platform, campaign_id, service_slug, paused_by_auto")
      .eq("market_id", rule.market_id);
    const core = [
      ...new Set((tagged ?? []).flatMap((c) => (c.service_slug ? [c.service_slug] : []))),
    ];
    const state: PauseState = State.parse(rule.state ?? {});
    const out = autoPause(
      {
        enabled: rule.enabled,
        minProviders: rule.min_providers,
        graceMinutes: rule.grace_minutes,
        startHour: rule.start_hour,
        endHour: rule.end_hour,
      },
      online,
      core,
      state,
      now,
      hour,
    );
    for (const [action, list] of [
      ["pause", out.pause],
      ["resume", out.resume],
    ] as const)
      for (const service of list) {
        const ids = (tagged ?? []).filter((c) => c.service_slug === service);
        for (const p of AD_PLATFORMS) {
          const mine = ids.filter((c) => c.platform === p).map((c) => c.campaign_id);
          if (mine.length && adapters[p])
            await adapters[p]!.setCampaignsPaused(mine, action === "pause");
        }
        await admin
          .from("ad_campaigns")
          .update({ paused_by_auto: action === "pause" })
          .eq("market_id", rule.market_id)
          .eq("service_slug", service);
        await admin.from("ad_pause_events").insert({
          market_id: rule.market_id,
          service_slug: service,
          action,
          campaigns: ids.map((c) => `${c.platform}:${c.campaign_id}`),
        });
        const marketName = markets?.find((m) => m.id === rule.market_id)?.name ?? "";
        const vars = {
          service,
          market: marketName,
          minutes: rule.grace_minutes,
          count: ids.length,
        };
        const title = fill(action === "pause" ? M().pausedTitle : M().resumedTitle, vars);
        await chooseEmailSender()
          .send({
            to: brand.emails.support,
            subject: title,
            react: AdsNoticeEmail({
              title,
              lines: [fill(action === "pause" ? M().pausedBody : M().resumedBody, vars)],
            }),
            tags: { category: "ads_autopause" },
          })
          .catch(() => null);
      }
    await admin
      .from("ad_pause_rules")
      .update({ state: out.state as never })
      .eq("market_id", rule.market_id);
    if (out.pause.length || out.resume.length)
      changes.push({ market: rule.market_id, pause: out.pause, resume: out.resume });
  }
  await record(admin, "autopause", true, { changes });
  return { markets: rules.length, changes };
}
