import "server-only";
import type { ProviderLogoData } from "@rsos/ui/provider-logo";
import { demoMarkets } from "@rsos/config/demo-fixtures";
import { demoRequestFromToken, demoState, demoStream } from "@rsos/core/demo";
import { getServerSupabase } from "@/lib/supabase/server";

export type RequestRow = {
  id: string;
  code: string;
  demo: boolean;
  market: string;
  service: string;
  status: string;
  driver: string;
  phone: string;
  createdAt: number;
};
export type TimelineItem = { label: string; at: number; detail?: string };
export type RequestDetail = RequestRow & {
  address: string;
  lat: number | null;
  lng: number | null;
  vehicle: string;
  safety: string[];
  quotes: {
    provider: string;
    logo: ProviderLogoData | null;
    priceCents: number;
    etaMinutes: number;
    at: number;
  }[];
  chosen: string | null;
  timeline: TimelineItem[];
  attribution: Record<string, string>;
  feeCents: number | null;
};

const digits = (s: string) => s.replace(/\D/g, "");
const matches = (r: RequestRow, q: string) =>
  !q ||
  r.code.toLowerCase().includes(q.toLowerCase()) ||
  (digits(q).length >= 3 && digits(r.phone).includes(digits(q))) ||
  r.driver.toLowerCase().includes(q.toLowerCase());

/** Real requests (staff market policies apply) plus demo ones in demo mode, newest first. */
export async function listRequests(opts: {
  q: string;
  markets: string[];
  demo: boolean;
  now: number;
}) {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("requests")
    .select(
      "id, short_code, status, driver_name, driver_phone, created_at, markets(slug), services(slug)",
    )
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(200);
  const real: RequestRow[] = (data ?? [])
    .map((r) => {
      const m = r.markets as unknown as { slug: string } | null;
      const s = r.services as unknown as { slug: string } | null;
      return {
        id: r.id,
        code: r.short_code,
        demo: false,
        market: m?.slug ?? "",
        service: s?.slug ?? "",
        status: r.status,
        driver: r.driver_name,
        phone: r.driver_phone,
        createdAt: Date.parse(r.created_at),
      };
    })
    .filter((r) => opts.markets.includes(r.market));
  const demo: RequestRow[] = opts.demo
    ? demoStream(opts.now, { markets: opts.markets.filter((m) => demoMarkets[m]) }).map((r) => ({
        id: r.token,
        code: r.code,
        demo: true,
        market: r.marketSlug,
        service: r.serviceSlug,
        status: demoState(r, opts.now).stage,
        driver: r.driver.name,
        phone: r.driver.phone,
        createdAt: r.createdAt,
      }))
    : [];
  return [...real, ...demo]
    .filter((r) => matches(r, opts.q.trim()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** One request with everything dispatch needs: inputs, quotes, timeline and attribution. */
export async function getRequestDetail(
  id: string,
  now: number,
  demoMode: boolean,
): Promise<RequestDetail | null> {
  if (id.startsWith("demo_")) {
    if (!demoMode) return null;
    const r = demoRequestFromToken(id, now);
    if (!r) return null;
    const s = demoState(r, now);
    return {
      id,
      code: r.code,
      demo: true,
      market: r.marketSlug,
      service: r.serviceSlug,
      status: s.stage,
      driver: r.driver.name,
      phone: r.driver.phone,
      createdAt: r.createdAt,
      address: `${r.location.area}${r.location.highway ? ` · ${r.location.highway}` : ""}`,
      lat: r.location.lat,
      lng: r.location.lng,
      vehicle: `${r.vehicle.year} ${r.vehicle.color} ${r.vehicle.make} ${r.vehicle.model}`,
      safety: [
        ...(r.safety.safe ? [] : ["unsafe"]),
        ...(r.safety.onHighway ? ["highway"] : []),
        ...(r.safety.passengers ? ["passengers"] : []),
      ],
      quotes: s.quotes.map((q) => ({
        provider: q.provider.name,
        logo: q.provider.logo,
        priceCents: q.priceCents,
        etaMinutes: q.etaMinutes,
        at: r.createdAt + q.arrivesAtSec * 1000,
      })),
      chosen: s.picked?.provider.name ?? null,
      timeline: s.timeline.map((x) => ({ label: x.stage, at: r.createdAt + x.atSec * 1000 })),
      attribution: { source: r.source },
      feeCents: null,
    };
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await getServerSupabase();
  const [{ data: r }, { data: events }, { data: attr }] = await Promise.all([
    supabase.from("requests").select("*, markets(slug), services(slug)").eq("id", id).maybeSingle(),
    supabase
      .from("request_events")
      .select("event_type, to_status, created_at, data")
      .eq("request_id", id)
      .order("created_at"),
    supabase.from("attributions").select("*").eq("request_id", id).maybeSingle(),
  ]);
  if (!r) return null;
  const m = r.markets as unknown as { slug: string } | null;
  const sv = r.services as unknown as { slug: string } | null;
  const attribution = Object.fromEntries(
    Object.entries(attr ?? {}).filter(
      ([k, v]) =>
        v && typeof v === "string" && !["id", "request_id", "created_at", "ip_hash"].includes(k),
    ) as [string, string][],
  );
  return {
    id: r.id,
    code: r.short_code,
    demo: false,
    market: m?.slug ?? "",
    service: sv?.slug ?? "",
    status: r.status,
    driver: r.driver_name,
    phone: r.driver_phone,
    createdAt: Date.parse(r.created_at),
    address: [r.pickup_address, r.pickup_note].filter(Boolean).join(" · "),
    lat: null,
    lng: null,
    vehicle: [r.vehicle_year, r.vehicle_color, r.vehicle_make, r.vehicle_model]
      .filter(Boolean)
      .join(" "),
    safety: [
      ...(r.safe_spot === false ? ["unsafe"] : []),
      ...(r.on_highway ? ["highway"] : []),
      ...(r.has_passengers ? ["passengers"] : []),
    ],
    quotes: [],
    chosen: null,
    timeline: (events ?? []).map((e) => ({
      label: e.to_status ?? e.event_type,
      at: Date.parse(e.created_at),
      detail:
        typeof (e.data as { reason?: unknown })?.reason === "string"
          ? String((e.data as { reason: string }).reason)
          : undefined,
    })),
    attribution: { channel: r.channel, ...attribution },
    feeCents: r.platform_fee_cents,
  };
}
