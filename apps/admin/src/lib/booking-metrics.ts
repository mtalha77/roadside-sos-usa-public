import "server-only";
import { brand } from "@rsos/config/brand";
import { sourceOf } from "@rsos/core/analytics-sources";
import {
  demoMetricData,
  type FlowEvent,
  type MetricCall,
  type MetricRequest,
} from "@rsos/core/booking-metrics";
import { getServerSupabase } from "@/lib/supabase/server";

const DAY = 86_400_000;
/** Fictional test numbers (555-0100 to 555-0199) and test cleanups never count as real. */
const TEST_PHONE = /55501\d\d$/;
const ms = (t: string | null | undefined) => (t ? Date.parse(t) : null);

export type MetricData = {
  requests: MetricRequest[];
  events: FlowEvent[];
  calls: MetricCall[];
  visits: number;
};

/**
 * Rows for the booking speed and funnel analytics (RSOS-111), real only: requests made since
 * `from` in the markets in view, their Get Help sessions, calls and visit counts. With
 * `includeDemo` (staging and previews only), labelled demo rows are added.
 */
export async function getMetricData(opts: {
  markets: { id: string; slug: string }[];
  services: string[];
  from: number;
  to: number;
  includeDemo: boolean;
}): Promise<MetricData> {
  const supabase = await getServerSupabase();
  const ids = opts.markets.map((m) => m.id);
  const slugOf = new Map(opts.markets.map((m) => [m.id, m.slug]));
  const since = new Date(opts.from).toISOString();
  const none = { data: [] as never[] };
  const [reqs, events, calls, visits] = await Promise.all([
    ids.length
      ? supabase
          .from("requests")
          .select(
            "id, market_id, channel, source, driver_phone, end_reason, booking_mode, submitted_at, created_at, quoted_at, accepted_at, completed_at, services(slug), attributions(device, gclid, gbraid, wbraid, fbclid, msclkid, utm_source, referrer)",
          )
          .in("market_id", ids)
          .neq("status", "draft")
          .gte("created_at", since)
          .limit(10_000)
      : Promise.resolve(none),
    supabase
      .from("funnel_events")
      .select(
        "session_id, event, step, last_field, market_id, source, device, landing_sec, request_id, occurred_at",
      )
      .gte("occurred_at", since)
      .limit(20_000),
    ids.length
      ? supabase
          .from("calls")
          .select("id, market_id, source, answered_at, duration_sec, request_id, direction")
          .in("market_id", ids)
          .eq("direction", "inbound")
          .gte("created_at", since)
          .limit(10_000)
      : Promise.resolve(none),
    supabase
      .from("site_visits")
      .select("visits")
      .gte("day", since.slice(0, 10))
      .in(
        "market_key",
        opts.markets.map((m) => m.slug),
      ),
  ]);
  const eventRows = (events.data ?? []).filter((e) => !e.market_id || ids.includes(e.market_id));
  const landing = new Map(
    eventRows.flatMap((e) =>
      e.request_id && e.landing_sec !== null ? [[e.request_id, e.landing_sec] as const] : [],
    ),
  );
  const requestRows = (reqs.data ?? []).filter(
    (r) => !TEST_PHONE.test(r.driver_phone ?? "") && r.end_reason !== "test cleanup",
  );
  const byId = new Map(requestRows.map((r) => [r.id, r]));
  const requests: MetricRequest[] = requestRows.map((r) => {
    const a = (Array.isArray(r.attributions) ? r.attributions[0] : r.attributions) as {
      device?: string | null;
      gclid?: string | null;
      gbraid?: string | null;
      wbraid?: string | null;
      fbclid?: string | null;
      msclkid?: string | null;
      utm_source?: string | null;
      referrer?: string | null;
    } | null;
    const svc = (Array.isArray(r.services) ? r.services[0] : r.services) as {
      slug?: string;
    } | null;
    return {
      id: r.id,
      market: slugOf.get(r.market_id) ?? "",
      source: sourceOf({
        gclid: a?.gclid,
        gbraid: a?.gbraid,
        wbraid: a?.wbraid,
        fbclid: a?.fbclid,
        msclkid: a?.msclkid,
        utmSource: a?.utm_source,
        referrer: a?.referrer,
        phonePurpose: r.source,
        ownHost: brand.domain,
      }),
      service: svc?.slug ?? "unknown",
      device: a?.device === "mobile" || a?.device === "desktop" ? a.device : null,
      channel: r.channel === "phone" ? "phone" : "website",
      mode: r.booking_mode === "instant" ? "instant" : "compare",
      demo: false,
      landingSec: landing.get(r.id) ?? null,
      submittedAt: ms(r.submitted_at) ?? ms(r.created_at)!,
      quotedAt: ms(r.quoted_at),
      bookedAt: ms(r.accepted_at),
      completedAt: ms(r.completed_at),
    };
  });
  const flow: FlowEvent[] = eventRows.map((e) => ({
    session: e.session_id,
    event: e.event as FlowEvent["event"],
    step: e.step,
    field: e.last_field,
    market: e.market_id ? (slugOf.get(e.market_id) ?? null) : null,
    source: e.source,
    device: e.device === "mobile" || e.device === "desktop" ? e.device : null,
    demo: false,
    at: Date.parse(e.occurred_at),
  }));
  const callRows: MetricCall[] = (calls.data ?? []).map((c) => {
    const req = c.request_id ? byId.get(c.request_id) : undefined;
    return {
      id: c.id,
      market: slugOf.get(c.market_id) ?? "",
      source: c.source ?? "direct",
      demo: false,
      answered: c.answered_at !== null,
      qualified: (c.duration_sec ?? 0) >= 30 || c.request_id !== null,
      booked: !!req?.accepted_at,
      completed: !!req?.completed_at,
    };
  });
  const real: MetricData = {
    requests,
    events: flow,
    calls: callRows,
    visits: (visits.data ?? []).reduce((n, v) => n + v.visits, 0),
  };
  if (!opts.includeDemo) return real;
  const demo = demoMetricData({
    markets: opts.markets.map((m) => m.slug),
    services: opts.services,
    from: Math.floor(opts.from / DAY) * DAY,
    to: opts.to,
  });
  return {
    requests: [...real.requests, ...demo.requests],
    events: [...real.events, ...demo.events],
    calls: [...real.calls, ...demo.calls],
    visits: real.visits + demo.visits,
  };
}

/** Service slugs and names (for the "Funnel by service" table and the demo rows). */
export async function getServiceNames(): Promise<Record<string, string>> {
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("services").select("slug, name").order("sort_order");
  return Object.fromEntries((data ?? []).map((s) => [s.slug, s.name]));
}
