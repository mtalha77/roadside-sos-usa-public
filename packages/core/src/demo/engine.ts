import { demoColors, demoMarkets, demoPeople, demoVehicles } from "@rsos/config/demo-fixtures";

/** Seeded pseudo-random numbers (mulberry32): same seed, same demo, in every app. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;

export const DEMO_SERVICES = [
  "flat-tire",
  "wont-start",
  "locked-out",
  "out-of-gas",
  "tow",
] as const;
export type DemoServiceSlug = (typeof DEMO_SERVICES)[number];
export type PriceRanges = Record<string, { min: number; max: number }>;

/** Fallback ranges (cents) when real market prices are not passed in (tests, empty databases). */
export const DEFAULT_DEMO_RANGES: PriceRanges = {
  "flat-tire": { min: 5000, max: 16000 },
  "wont-start": { min: 5000, max: 15000 },
  "locked-out": { min: 5000, max: 17000 },
  "out-of-gas": { min: 5000, max: 19000 },
  tow: { min: 8200, max: 13000 },
};

export type LatLng = { lat: number; lng: number };
export type DemoProvider = {
  id: string;
  name: string;
  slug: string;
  area: string;
  trucks: number;
  rating: number | null;
  reviews: number;
  home: LatLng;
  marketSlug: string;
};
export type DemoQuote = {
  id: string;
  provider: DemoProvider;
  priceCents: number;
  etaMinutes: number;
  arrivesAtSec: number;
};
export type DemoStage =
  | "searching"
  | "quoting"
  | "picked"
  | "en_route"
  | "on_site"
  | "completed"
  | "cancelled"
  | "expired";
export type DemoRequest = {
  id: string;
  code: string;
  token: string;
  demo: true;
  marketSlug: string;
  serviceSlug: DemoServiceSlug;
  createdAt: number;
  source: "web" | "phone" | "google_ads" | "meta" | "organic";
  driver: { name: string; phone: string };
  vehicle: { make: string; model: string; type: string; color: string; year: number; ev: boolean };
  location: LatLng & { area: string; note: string; highway: string | null };
  destination: (LatLng & { label: string; miles: number }) | null;
  safety: { safe: boolean; onHighway: boolean; passengers: number };
  quotes: DemoQuote[];
  outcome: "completed" | "cancelled" | "expired";
};

/** Scenario timing, in seconds after the request was sent (compressed so screens feel alive). */
export const TIMING = { pickAt: 190, travelSec: 360, workSec: 480, cancelAt: 120, expireAt: 180 };

export function demoProviders(marketSlug: string): DemoProvider[] {
  const m = demoMarkets[marketSlug];
  if (!m) return [];
  return m.providers.map((p, i) => {
    const area = m.areas.find((a) => a.name === p.area) ?? m.areas[0]!;
    return {
      id: `demo-prov-${marketSlug}-${i}`,
      ...p,
      home: { lat: area.lat, lng: area.lng },
      marketSlug,
    };
  });
}

const miles = (a: LatLng, b: LatLng) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};
const round5 = (cents: number) => Math.round(cents / 500) * 500;

/** One demo request, fully determined by its market, seed and creation time. */
export function makeDemoRequest(
  marketSlug: string,
  seed: number,
  createdAt: number,
  ranges: PriceRanges = DEFAULT_DEMO_RANGES,
): DemoRequest | null {
  const m = demoMarkets[marketSlug];
  if (!m) return null;
  const r = rng(seed);
  const service = pick(r, DEMO_SERVICES);
  const area = pick(r, m.areas);
  const at = { lat: area.lat + (r() - 0.5) * 0.04, lng: area.lng + (r() - 0.5) * 0.04 };
  const v = pick(r, demoVehicles);
  const onHighway = r() < 0.35;
  const highway = onHighway ? pick(r, m.highways) : null;
  const range = ranges[service] ?? DEFAULT_DEMO_RANGES[service]!;
  const providers = demoProviders(marketSlug);
  const count = 2 + Math.floor(r() * 3);
  const quotes: DemoQuote[] = providers
    .slice()
    .sort(() => r() - 0.5)
    .slice(0, Math.min(count, providers.length))
    .map((p, i) => ({
      id: `${seed}-q${i}`,
      provider: p,
      priceCents: round5(range.min + r() * (range.max - range.min)),
      etaMinutes: Math.max(8, Math.round(miles(p.home, at) * 2.2 + 6 + r() * 10)),
      arrivesAtSec: Math.round(20 + i * 35 + r() * 25),
    }));
  const roll = r();
  const destArea = pick(r, m.areas);
  const dest = { lat: destArea.lat, lng: destArea.lng };
  const id = `demo-${marketSlug}-${seed}`;
  return {
    id,
    code: `D-${(seed % 46656).toString(36).toUpperCase().padStart(3, "0")}${String.fromCharCode(65 + (seed % 26))}`,
    token: `demo_${marketSlug}_${seed.toString(36)}`,
    demo: true,
    marketSlug,
    serviceSlug: service,
    createdAt,
    source: pick(r, ["web", "web", "phone", "google_ads", "meta", "organic"] as const),
    driver: {
      name: `${pick(r, demoPeople.first)} ${pick(r, demoPeople.lastInitial)}.`,
      phone: `+1${m.areaCode}55501${String(Math.floor(r() * 100)).padStart(2, "0")}`,
    },
    vehicle: {
      make: v.make,
      model: v.model,
      type: v.type,
      color: pick(r, demoColors),
      year: 2012 + Math.floor(r() * 13),
      ev: "ev" in v && v.ev === true,
    },
    location: {
      ...at,
      area: area.name,
      note: highway
        ? `${highway} shoulder near the ${area.name} exit`
        : `Parking lot in ${area.name}`,
      highway,
    },
    destination:
      service === "tow"
        ? {
            ...dest,
            label: `Repair shop in ${destArea.name}`,
            miles: Math.max(2, Math.round(miles(at, dest) * 10) / 10),
          }
        : null,
    safety: { safe: !onHighway || r() < 0.7, onHighway, passengers: Math.floor(r() * 3) },
    quotes,
    outcome: roll < 0.08 ? "expired" : roll < 0.16 ? "cancelled" : "completed",
  };
}

export type DemoState = {
  stage: DemoStage;
  elapsedSec: number;
  quotes: DemoQuote[];
  picked: DemoQuote | null;
  /** 0 to 1 along the drive from the provider's base to the driver. */
  progress: number;
  truck: LatLng | null;
  etaMinutes: number | null;
  timeline: { stage: DemoStage; atSec: number }[];
};

/** Where a demo request is at `now` (ms). Pure: every app computes the same answer. */
export function demoState(req: DemoRequest, now: number): DemoState {
  const t = Math.max(0, (now - req.createdAt) / 1000);
  const arrived = req.quotes.filter((q) => q.arrivesAtSec <= t);
  const timeline: DemoState["timeline"] = [{ stage: "searching", atSec: 0 }];
  if (req.quotes[0] && req.outcome !== "expired")
    timeline.push({ stage: "quoting", atSec: req.quotes[0].arrivesAtSec });
  const base = {
    elapsedSec: Math.round(t),
    quotes: req.outcome === "expired" ? [] : arrived,
    picked: null,
    progress: 0,
    truck: null,
    etaMinutes: null,
  };
  if (req.outcome === "expired") {
    if (t >= TIMING.expireAt)
      return {
        ...base,
        stage: "expired",
        timeline: [...timeline, { stage: "expired", atSec: TIMING.expireAt }],
      };
    return { ...base, stage: "searching", timeline };
  }
  if (req.outcome === "cancelled" && t >= TIMING.cancelAt) {
    return {
      ...base,
      stage: "cancelled",
      timeline: [
        ...timeline.filter((x) => x.atSec <= TIMING.cancelAt),
        { stage: "cancelled", atSec: TIMING.cancelAt },
      ],
    };
  }
  if (t < TIMING.pickAt)
    return {
      ...base,
      stage: arrived.length ? "quoting" : "searching",
      timeline: timeline.filter((x) => x.atSec <= t),
    };
  // The driver picks the fastest quote.
  const picked = [...req.quotes].sort((a, b) => a.etaMinutes - b.etaMinutes)[0]!;
  const drive = TIMING.pickAt + 10;
  const arrive = drive + TIMING.travelSec;
  const done = arrive + TIMING.workSec;
  timeline.push({ stage: "picked", atSec: TIMING.pickAt });
  const progress = Math.min(1, Math.max(0, (t - drive) / TIMING.travelSec));
  const truck = {
    lat: picked.provider.home.lat + (req.location.lat - picked.provider.home.lat) * progress,
    lng: picked.provider.home.lng + (req.location.lng - picked.provider.home.lng) * progress,
  };
  const common = { ...base, quotes: req.quotes, picked, progress, truck };
  if (t < drive) return { ...common, stage: "picked", etaMinutes: picked.etaMinutes, timeline };
  timeline.push({ stage: "en_route", atSec: drive });
  if (t < arrive)
    return {
      ...common,
      stage: "en_route",
      etaMinutes: Math.max(1, Math.round(picked.etaMinutes * (1 - progress))),
      timeline,
    };
  timeline.push({ stage: "on_site", atSec: arrive });
  if (t < done) return { ...common, stage: "on_site", etaMinutes: 0, timeline };
  timeline.push({ stage: "completed", atSec: done });
  return { ...common, stage: "completed", etaMinutes: 0, timeline };
}

/** Lifetime of a demo request in the live stream (seconds). */
export const DEMO_LIFETIME_SEC = TIMING.pickAt + 10 + TIMING.travelSec + TIMING.workSec + 120;

/**
 * The live demo stream: every market gets a new request every `intervalSec`, keyed to the wall
 * clock, so the provider portal, the admin dashboard and the website all show the same requests at
 * the same moment, with no server state.
 */
export function demoStream(
  now: number,
  opts: { markets: string[]; intervalSec?: number; ranges?: Record<string, PriceRanges> },
): DemoRequest[] {
  const interval = (opts.intervalSec ?? 75) * 1000;
  const out: DemoRequest[] = [];
  const latest = Math.floor(now / interval);
  const back = Math.ceil((DEMO_LIFETIME_SEC * 1000) / interval);
  opts.markets.forEach((slug, mi) => {
    for (let k = 0; k <= back; k++) {
      const bucket = latest - k;
      const createdAt = bucket * interval + ((mi * 17_000) % interval);
      if (createdAt > now) continue;
      const req = makeDemoRequest(slug, bucket * 31 + mi * 7919, createdAt, opts.ranges?.[slug]);
      if (req) out.push(req);
    }
  });
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Find a demo request from its tracking token (demo tokens encode market and seed). */
export function demoRequestFromToken(
  token: string,
  now: number,
  ranges?: PriceRanges,
): DemoRequest | null {
  const m = /^demo_([a-z0-9-]+)_([0-9a-z]+)$/.exec(token);
  if (!m) return null;
  const seed = parseInt(m[2]!, 36);
  const fromStream = demoStream(now, { markets: [m[1]!] }).find((r) => r.token === token);
  return fromStream ?? makeDemoRequest(m[1]!, seed, now - 5_000, ranges);
}
