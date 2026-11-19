import "server-only";
import type { ProviderLogoData } from "@rsos/ui/provider-logo";
import { demoMarkets } from "@rsos/config/demo-fixtures";
import { demoProviders, demoState, demoStream, rng, seedFrom } from "@rsos/core/demo";
import { getServerSupabase } from "@/lib/supabase/server";
import { type Lane, needsClosing } from "./board-time";

export type { Lane } from "./board-time";
export type BoardCard = {
  id: string;
  code: string;
  demo: boolean;
  market: string;
  service: string;
  lane: Lane;
  createdAt: number;
  /** The last time the request moved forward (closing is measured from here). */
  progressAt: number;
  quotes: number;
  driver: string;
  phone: string;
  area: string;
  lat: number | null;
  lng: number | null;
  provider: string | null;
  /** Demo providers only: their monogram logo. */
  providerLogo?: ProviderLogoData | null;
  truck: { lat: number; lng: number } | null;
  token: string | null;
  /** RSOS-110: how the request reached us (the website or a call). */
  channel: "website" | "phone";
  /** RSOS-109: the Instant book ceiling in cents, or null when the customer compares quotes. */
  instantMaxCents: number | null;
};
export type MapArea = { market: string; name: string; lat: number; lng: number };
export type SupplyRow = { market: string; area: string; online: number; trucks: number };

const LANE_OF: Record<string, Lane | null> = {
  submitted: "new",
  searching: "new",
  quoting: "quoting",
  quoted: "quoting",
  accepted: "picked",
  picked: "picked",
  en_route: "en_route",
  on_site: "on_site",
};
const ms = (t: string | null) => (t ? Date.parse(t) : 0);

/** Real requests from the database (staff market policies apply). */
async function realCards(markets: string[]): Promise<BoardCard[]> {
  const supabase = await getServerSupabase();
  const { data } = await (supabase.rpc as unknown as (f: string) => PromiseLike<{ data: unknown }>)(
    "admin_live_requests",
  );
  const rows = (Array.isArray(data) ? data : []) as {
    id: string;
    short_code: string;
    status: string;
    market_slug: string;
    service_slug: string;
    driver_name: string;
    driver_phone: string;
    pickup_address: string;
    lat: number | null;
    lng: number | null;
    created_at: string;
    submitted_at: string | null;
    quoted_at: string | null;
    accepted_at: string | null;
    en_route_at: string | null;
    on_site_at: string | null;
    status_token: string;
    channel: string;
    booking_mode: string | null;
    instant_max_cents: number | null;
  }[];
  return rows
    .filter((r) => markets.includes(r.market_slug) && LANE_OF[r.status])
    .map((r) => ({
      id: r.id,
      code: r.short_code,
      demo: false,
      market: r.market_slug,
      service: r.service_slug,
      lane: LANE_OF[r.status]!,
      createdAt: ms(r.submitted_at) || ms(r.created_at),
      progressAt: Math.max(
        ms(r.created_at),
        ms(r.submitted_at),
        ms(r.quoted_at),
        ms(r.accepted_at),
        ms(r.en_route_at),
        ms(r.on_site_at),
      ),
      quotes: 0,
      driver: r.driver_name,
      phone: r.driver_phone,
      area: r.pickup_address,
      lat: r.lat,
      lng: r.lng,
      provider: null,
      truck: null,
      token: r.status_token,
      channel: r.channel === "phone" ? ("phone" as const) : ("website" as const),
      instantMaxCents: r.booking_mode === "instant" ? r.instant_max_cents : null,
    }));
}

/** Demo requests from the shared scenario stream (demo mode only). `load` packs ~200 requests. */
function demoCards(now: number, markets: string[], load: boolean): BoardCard[] {
  const known = markets.filter((m) => demoMarkets[m]);
  const intervalSec = load ? Math.max(3, Math.round(15 / Math.max(1, known.length / 3))) : 75;
  return demoStream(now, { markets: known, intervalSec })
    .map((r): BoardCard | null => {
      const s = demoState(r, now);
      const lane = LANE_OF[s.stage];
      if (!lane) return null;
      return {
        id: r.id,
        code: r.code,
        demo: true,
        market: r.marketSlug,
        service: r.serviceSlug,
        lane: s.stage === "searching" && s.quotes.length ? "quoting" : lane,
        createdAt: r.createdAt,
        progressAt: r.createdAt,
        quotes: s.quotes.length,
        driver: r.driver.name,
        phone: r.driver.phone,
        area: r.location.area,
        lat: r.location.lat,
        lng: r.location.lng,
        provider: s.picked?.provider.name ?? null,
        providerLogo: s.picked?.provider.logo ?? null,
        truck: s.truck,
        token: load ? null : r.token,
        channel: r.source === "phone" ? "phone" : "website",
        instantMaxCents: r.instant?.maxCents ?? null,
      };
    })
    .filter((c): c is BoardCard => c !== null);
}

/** Online providers per market and area; areas with nobody online are the gaps. */
function supply(now: number, markets: string[]): SupplyRow[] {
  const slot = Math.floor(now / 600_000);
  return markets.flatMap((m) => {
    const fx = demoMarkets[m];
    if (!fx) return [];
    const provs = demoProviders(m);
    return fx.areas.map((a) => {
      const here = provs.filter((p) => p.area === a.name);
      const online = here.filter((p) => rng(seedFrom(p.slug) ^ slot)() > 0.3).length;
      return { market: m, area: a.name, online, trucks: here.reduce((n, p) => n + p.trucks, 0) };
    });
  });
}

/** Everything the dispatch board shows: real requests first, demo ones (labelled) in demo mode. */
export async function getBoard(opts: {
  now: number;
  markets: string[];
  demo: boolean;
  load: boolean;
}) {
  const [real] = await Promise.all([realCards(opts.markets)]);
  const demo = opts.demo ? demoCards(opts.now, opts.markets, opts.load) : [];
  const cards = [...real, ...demo].map((c) =>
    needsClosing(opts.now - c.progressAt) ? { ...c, lane: "closing" as const } : c,
  );
  // Neighbourhood names give the placeholder map its city context.
  const areas: MapArea[] = opts.markets.flatMap((m) =>
    (demoMarkets[m]?.areas ?? []).map((a) => ({ market: m, ...a })),
  );
  return {
    now: opts.now,
    cards,
    areas,
    supply: opts.demo ? supply(opts.now, opts.markets) : [],
  };
}
export type Board = Awaited<ReturnType<typeof getBoard>>;
