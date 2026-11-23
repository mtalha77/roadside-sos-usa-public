import "server-only";
import { brand } from "@rsos/config/brand";
import { syncHealth, unusual } from "@rsos/core/ads";
import { createAdminSupabase } from "@rsos/db/admin";
import { AdsNoticeEmail, chooseEmailSender } from "@rsos/emails";
import { fill, getMessages } from "@rsos/i18n";
import { z } from "zod";

const M = () => getMessages("en").emails.ads;
const Setting = z.object({ value: z.unknown() });
const Row = z.object({
  market_id: z.string(),
  spend_cents: z.coerce.number(),
  clicks: z.coerce.number(),
  calls: z.coerce.number(),
  qualified_calls: z.coerce.number(),
  requests: z.coerce.number(),
  assigned: z.coerce.number(),
  completed: z.coerce.number(),
  fees_cents: z.coerce.number(),
});
type Row = z.infer<typeof Row>;

/**
 * The owner's daily ads email (RSOS-107), checked hourly: at the configured hour in the owner's
 * time zone (system settings `ads_email_hour`, default 8, and `owner_time_zone`), once a day:
 * yesterday per market, and anything unusual (spend with zero requests, cost per completed job
 * above `ads_max_cost_per_job_cents`, failing syncs).
 */
export async function sendDailyEmail(opts: { now?: number; force?: boolean } = {}) {
  const admin = createAdminSupabase();
  const now = opts.now ?? Date.now();
  const { data: settings } = await admin
    .from("system_settings")
    .select("key, value")
    .in("key", ["ads_email_hour", "owner_time_zone", "ads_max_cost_per_job_cents"]);
  const get = (k: string) => Setting.safeParse(settings?.find((s) => s.key === k)).data?.value;
  const hour = z.number().int().min(0).max(23).catch(8).parse(get("ads_email_hour"));
  const tz = z
    .string()
    .catch("UTC")
    .parse(get("owner_time_zone") ?? "UTC");
  const maxCpj = z.number().int().catch(15_000).parse(get("ads_max_cost_per_job_cents"));
  const local = (t: number, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...o }).format(t);
  const nowHour = Number(local(now, { hour: "numeric", hourCycle: "h23" }));
  if (!opts.force && nowHour !== hour) return { sent: false, reason: "not the hour" };
  const { data: already } = await admin
    .from("sync_runs")
    .select("id")
    .eq("job", "email:daily")
    .eq("ok", true)
    .gte("started_at", new Date(now - 20 * 3_600_000).toISOString())
    .limit(1);
  if (!opts.force && already?.length) return { sent: false, reason: "already sent today" };
  const yesterday = local(now - 86_400_000, { year: "numeric", month: "2-digit", day: "2-digit" });
  const [{ data: rows }, { data: markets }, { data: runs }] = await Promise.all([
    (admin.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>)(
      "ad_dashboard_for_owner",
      { p_from: yesterday, p_to: yesterday },
    ),
    admin.from("markets").select("id, name"),
    admin
      .from("sync_runs")
      .select("job, ok, started_at")
      .order("started_at", { ascending: false })
      .limit(200),
  ]);
  const perMarket = new Map<string, Row>();
  for (const r of z
    .array(Row)
    .catch([])
    .parse(rows ?? [])) {
    const m = perMarket.get(r.market_id);
    perMarket.set(
      r.market_id,
      m
        ? {
            market_id: r.market_id,
            spend_cents: m.spend_cents + r.spend_cents,
            clicks: m.clicks + r.clicks,
            calls: m.calls + r.calls,
            qualified_calls: m.qualified_calls + r.qualified_calls,
            requests: m.requests + r.requests,
            assigned: m.assigned + r.assigned,
            completed: m.completed + r.completed,
            fees_cents: m.fees_cents + r.fees_cents,
          }
        : { ...r },
    );
  }
  const name = (id: string) => markets?.find((m) => m.id === id)?.name ?? id;
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  const failing = syncHealth(
    (runs ?? []).map((r) => ({ job: r.job, ok: r.ok, at: Date.parse(r.started_at) })),
  )
    .filter((h) => h.alert)
    .map((h) => h.job);
  const flags = unusual(
    [...perMarket.values()].map((r) => ({
      marketId: r.market_id,
      spendCents: r.spend_cents,
      clicks: r.clicks,
      calls: r.calls,
      qualifiedCalls: r.qualified_calls,
      requests: r.requests,
      assigned: r.assigned,
      completed: r.completed,
      feesCents: r.fees_cents,
    })),
    { maxCostPerCompletedCents: maxCpj, failedJobs: failing },
  );
  const lines = [
    ...[...perMarket.values()].map((r) =>
      fill(M().dailyRow, {
        market: name(r.market_id),
        spend: usd(r.spend_cents),
        requests: r.requests,
        completed: r.completed,
        fees: usd(r.fees_cents),
      }),
    ),
    ...(flags.length
      ? flags.map((f) =>
          f.kind === "failed_sync"
            ? fill(M().unusualSync, { job: f.job ?? "" })
            : fill(f.kind === "spend_no_requests" ? M().unusualSpend : M().unusualCost, {
                market: name(f.marketId ?? ""),
                max: usd(maxCpj),
              }),
        )
      : [M().nothingUnusual]),
  ];
  const title = fill(M().dailyTitle, { day: yesterday });
  await chooseEmailSender()
    .send({
      to: brand.emails.support,
      subject: title,
      react: AdsNoticeEmail({ title, lines }),
      tags: { category: "ads_daily" },
    })
    .catch(() => null);
  await admin
    .from("sync_runs")
    .insert({ job: "email:daily", ok: true, details: { day: yesterday, unusual: flags.length } });
  return { sent: true, lines: lines.length };
}
