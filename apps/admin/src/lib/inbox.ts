import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";

/** Requests still being handled (manual dispatch, RSOS-034b). */
export const OPEN_STATUSES = [
  "phone_intake",
  "submitted",
  "quoting",
  "quoted",
  "contacted",
  "location_confirmed",
  "assigned",
  "en_route",
  "on_site",
] as const;
export type OpenStatus = (typeof OPEN_STATUSES)[number];

/** Manual dispatch steps in order (the step buttons offer the next ones). */
export const STEPS = [
  "contacted",
  "location_confirmed",
  "assigned",
  "en_route",
  "on_site",
  "completed",
] as const;

export const CLAIM_MINUTES = 10;

export type InboxItem = {
  id: string;
  code: string;
  status: string;
  urgent: boolean;
  marketId: string;
  driver: string;
  phone: string;
  service: string | null;
  channel: string;
  source: string | null;
  createdAt: number;
  owner: string | null;
  claimExpired: boolean;
  unread: boolean;
  lastCall: string | null;
  lastText: string | null;
};

/**
 * The live inbox: every open request in the dispatcher's markets (RLS), urgent first, then the
 * longest wait. A claim older than 10 minutes without action no longer counts (auto-unclaim).
 */
export async function getInbox(marketIds: string[]): Promise<{
  items: InboxItem[];
  unread: number;
  unassigned: number;
}> {
  const supabase = await getServerSupabase();
  if (marketIds.length === 0) return { items: [], unread: 0, unassigned: 0 };
  const [{ data: rows }, { data: staff }] = await Promise.all([
    supabase
      .from("requests")
      .select(
        "id, short_code, status, urgent, market_id, driver_name, driver_phone, channel, source, created_at, claimed_at, assigned_dispatcher_id, contacted_at, services(name), calls(outcome, created_at), sms_messages(direction, created_at)",
      )
      .in("market_id", marketIds)
      .in("status", [...OPEN_STATUSES])
      .order("created_at", { ascending: true })
      .limit(200),
    supabase.from("staff_members").select("user_id, display_name"),
  ]);
  const now = Date.now();
  const name = (id: string | null) =>
    id ? ((staff ?? []).find((s) => s.user_id === id)?.display_name ?? null) : null;
  const items: InboxItem[] = (rows ?? []).map((r) => {
    const claimedAt = r.claimed_at ? Date.parse(r.claimed_at) : 0;
    const fresh = Boolean(r.assigned_dispatcher_id) && now - claimedAt < CLAIM_MINUTES * 60_000;
    const calls = (r.calls ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const texts = (r.sms_messages ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const service = r.services as { name?: string } | null;
    return {
      id: r.id,
      code: r.short_code,
      status: r.status,
      urgent: r.urgent,
      marketId: r.market_id,
      driver: r.driver_name,
      phone: r.driver_phone,
      service: service?.name ?? null,
      channel: r.channel,
      source: r.source,
      createdAt: Date.parse(r.created_at),
      owner: fresh ? name(r.assigned_dispatcher_id) : null,
      claimExpired: Boolean(r.assigned_dispatcher_id) && !fresh,
      unread: !r.claimed_at && !r.contacted_at,
      lastCall: calls[0]?.outcome ?? null,
      lastText: texts[0]?.direction ?? null,
    };
  });
  items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.createdAt - b.createdAt);
  return {
    items,
    unread: items.filter((i) => i.unread).length,
    unassigned: items.filter((i) => !i.owner).length,
  };
}

export type TimelineEntry = {
  at: number;
  kind: "event" | "call" | "text";
  label: string;
  detail?: string | null;
  direction?: string | null;
};

/** One request for the side panel: details, timeline (events, calls, texts), dispatch data. */
export async function getInboxRequest(id: string) {
  const supabase = await getServerSupabase();
  const { data: r } = await supabase
    .from("requests")
    .select(
      "id, short_code, status, urgent, market_id, service_id, driver_name, driver_phone, pickup_address, pickup_note, notes, vehicle_year, vehicle_make, vehicle_model, vehicle_color, vehicle_type, safe_spot, on_highway, has_passengers, channel, source, created_at, claimed_at, assigned_dispatcher_id, assigned_provider_id, quoted_price_cents, quoted_eta_minutes, end_reason, status_token, platform_fee_cents, services(slug, name), markets(name, slug, time_zone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const [events, calls, texts, providers, replies, services, attempts, staff, point] =
    await Promise.all([
      supabase
        .from("request_events")
        .select("event_type, from_status, to_status, data, created_at, actor_id")
        .eq("request_id", id)
        .order("created_at"),
      supabase
        .from("calls")
        .select(
          "id, direction, outcome, created_at, duration_sec, recording_sid, voicemail_transcript",
        )
        .eq("request_id", id)
        .order("created_at"),
      supabase
        .from("sms_messages")
        .select("id, direction, body, status, status_reason, created_at")
        .eq("request_id", id)
        .order("created_at"),
      supabase.rpc("nearby_providers", { p_request_id: id }),
      supabase.from("saved_replies").select("id, title, body").order("sort_order"),
      supabase
        .from("current_market_services")
        .select("service_id, enabled, services(slug, name)")
        .eq("market_id", r.market_id)
        .eq("enabled", true),
      supabase
        .from("dispatch_attempts")
        .select("provider_id, outcome, quoted_price_cents, quoted_eta_minutes, created_at")
        .eq("request_id", id)
        .order("created_at"),
      supabase.from("staff_members").select("user_id, display_name"),
      supabase.rpc("request_point", { p_request_id: id }),
    ]);
  const timeline: TimelineEntry[] = [
    ...(events.data ?? []).map((e) => ({
      at: Date.parse(e.created_at),
      kind: "event" as const,
      label: e.event_type === "status" ? `status:${e.to_status ?? ""}` : e.event_type,
      detail:
        typeof (e.data as { note?: unknown } | null)?.note === "string"
          ? (e.data as { note: string }).note
          : typeof (e.data as { reason?: unknown } | null)?.reason === "string"
            ? (e.data as { reason: string }).reason
            : null,
    })),
    ...(calls.data ?? []).map((c) => ({
      at: Date.parse(c.created_at),
      kind: "call" as const,
      label: c.outcome,
      direction: c.direction,
      detail: c.voicemail_transcript,
    })),
    ...(texts.data ?? []).map((t) => ({
      at: Date.parse(t.created_at),
      kind: "text" as const,
      label: t.status,
      direction: t.direction,
      detail: t.body,
    })),
  ].sort((a, b) => a.at - b.at);
  const pt = Array.isArray(point.data) ? point.data[0] : null;
  return {
    request: r,
    point: pt ? { lat: pt.lat, lng: pt.lng } : null,
    timeline,
    calls: calls.data ?? [],
    texts: texts.data ?? [],
    providers: providers.data ?? [],
    replies: replies.data ?? [],
    services: (services.data ?? []).flatMap((s) => {
      const svc = s.services as { slug?: string; name?: string } | null;
      return svc?.slug && s.service_id
        ? [{ id: s.service_id, slug: svc.slug, name: svc.name ?? svc.slug }]
        : [];
    }),
    attempts: attempts.data ?? [],
    owner:
      (staff.data ?? []).find((s) => s.user_id === r.assigned_dispatcher_id)?.display_name ?? null,
  };
}
export type InboxRequest = NonNullable<Awaited<ReturnType<typeof getInboxRequest>>>;
