import { SERVICE_QUESTIONS } from "../service-questions";
import {
  type DemoMarketFixture,
  demoColors,
  demoMarkets,
  demoPeople,
  demoVehicles,
} from "@rsos/config/demo-fixtures";

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
  logo: DemoMarketFixture["providers"][number]["logo"];
  years: number;
  payments: DemoMarketFixture["providers"][number]["payments"];
};
export type DemoQuote = {
  id: string;
  provider: DemoProvider;
  priceCents: number;
  etaMinutes: number;
  arrivesAtSec: number;
  /** Demo: the second provider asked pays for Featured placement (RSOS-114). */
  featured?: boolean;
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
  /** Instant book (RSOS-109): the customer's ceiling, or null when they compare quotes. */
  instant: { maxCents: number } | null;
  /** RSOS-116: the customer's Get Help answers for the service (demo values). */
  answers: Record<string, string>;
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
  const r = rng((seed ^ seedFrom(marketSlug)) >>> 0);
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
      featured: i === 1,
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
    // About a third of demo customers book the fastest provider automatically, at the market's
    // typical price (a separate generator, so every other detail stays the same as before).
    answers: demoAnswers(service, rng((seed ^ 0x2545f491) >>> 0)),
    instant:
      rng((seed ^ 0x5bd1e995) >>> 0)() < 0.33
        ? { maxCents: round5((range.min + range.max) / 2) }
        : null,
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

export type DemoPick = { quoteId: string; atSec: number };

/**
 * Where a demo request is at `now` (ms). Pure: every app computes the same answer. `pick` is the
 * driver's own choice (which quote, and when); without it the fastest quote is picked at 190 s.
 */
export type DemoStateOptions = {
  /** Shorter timing for the driver's own demo (see DRIVER_DEMO_TIMING). */
  timing?: Partial<typeof TIMING>;
  /**
   * The driver drives the demo: nothing is picked for them (it waits on the quotes until they
   * choose) and the job always completes (no simulated cancel or expiry).
   */
  driverControlled?: boolean;
};

/** The driver's demo on the status page: about 20 s on the way and 20 s on site. */
export const DRIVER_DEMO_TIMING = { travelSec: 20, workSec: 20 } as const;

export function demoState(
  req: DemoRequest,
  now: number,
  pick?: DemoPick | null,
  opts: DemoStateOptions = {},
): DemoState {
  const T = { ...TIMING, ...opts.timing };
  if (opts.driverControlled) req = { ...req, outcome: "completed" };
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
    if (t >= T.expireAt)
      return {
        ...base,
        stage: "expired",
        timeline: [...timeline, { stage: "expired", atSec: T.expireAt }],
      };
    return { ...base, stage: "searching", timeline };
  }
  if (req.outcome === "cancelled" && t >= T.cancelAt) {
    return {
      ...base,
      stage: "cancelled",
      timeline: [
        ...timeline.filter((x) => x.atSec <= T.cancelAt),
        { stage: "cancelled", atSec: T.cancelAt },
      ],
    };
  }
  // Instant book: the first quote at or below the ceiling books itself (else the usual pick).
  if (!pick && !opts.driverControlled && req.instant) {
    const auto = instantPick(req.quotes, req.instant.maxCents, 0, T.expireAt);
    if (auto) pick = auto;
  }
  const pickAt = pick ? pick.atSec : opts.driverControlled ? Infinity : T.pickAt;
  if (t < pickAt)
    return {
      ...base,
      stage: arrived.length ? "quoting" : "searching",
      timeline: timeline.filter((x) => x.atSec <= t),
    };
  const picked =
    req.quotes.find((q) => q.id === pick?.quoteId) ??
    [...req.quotes].sort((a, b) => a.etaMinutes - b.etaMinutes)[0]!;
  const drive = pickAt + 10;
  const arrive = drive + T.travelSec;
  const done = arrive + T.workSec;
  timeline.push({ stage: "picked", atSec: pickAt });
  const progress = Math.min(1, Math.max(0, (t - drive) / T.travelSec));
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

/** Stages the driver's stepper shows, in order. */
export const DRIVER_STAGES = [
  "searching",
  "quoting",
  "picked",
  "en_route",
  "on_site",
  "completed",
] as const satisfies readonly DemoStage[];

/**
 * When each stage starts (seconds after the request), for the driver's demo: going back to a
 * stage or skipping ahead sets the demo clock to its start. Stages after "quoting" need a pick.
 */
export function driverStageStarts(
  req: DemoRequest,
  pick: DemoPick | null,
  timing: Partial<typeof TIMING> = DRIVER_DEMO_TIMING,
): Record<(typeof DRIVER_STAGES)[number], number | null> {
  const T = { ...TIMING, ...timing };
  const first = req.quotes[0]?.arrivesAtSec ?? null;
  if (!pick)
    return {
      searching: 0,
      quoting: first,
      picked: null,
      en_route: null,
      on_site: null,
      completed: null,
    };
  const drive = pick.atSec + 10;
  return {
    searching: 0,
    quoting: first,
    picked: pick.atSec,
    en_route: drive,
    on_site: drive + T.travelSec,
    completed: drive + T.travelSec + T.workSec,
  };
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
  for (const slug of opts.markets) {
    for (let k = 0; k <= back; k++) {
      const bucket = latest - k;
      const createdAt = slotTime(slug, bucket, interval);
      if (createdAt > now) continue;
      const req = makeDemoRequest(slug, bucket, createdAt, opts.ranges?.[slug]);
      if (req) out.push(req);
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** When a stream slot's request was sent: each market has its own fixed offset inside the slot. */
function slotTime(market: string, bucket: number, interval: number): number {
  return bucket * interval + (seedFrom(market) % interval);
}

/** Find a demo request from its tracking token (demo tokens encode market and time slot). */
export function demoRequestFromToken(
  token: string,
  now: number,
  ranges?: PriceRanges,
): DemoRequest | null {
  const m = /^demo_([a-z0-9-]+)_([0-9a-z]+)$/.exec(token);
  if (!m) return null;
  // The token holds the market and the time slot, so the request is rebuilt exactly, in any app.
  const bucket = parseInt(m[2]!, 36);
  const createdAt = slotTime(m[1]!, bucket, 75_000);
  if (!Number.isFinite(bucket) || createdAt > now) return null;
  return makeDemoRequest(m[1]!, bucket, createdAt, ranges);
}

/** A stable seed from any string (FNV-1a), e.g. to simulate providers for a real request in demo mode. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h % 1_000_000_007;
}

/**
 * Instant book (RSOS-109): the first quote (in arrival order) at or below the ceiling, booked the
 * moment it arrives, or the moment the customer switched to Instant book if it was already in.
 * Quotes after the window never book. Null when nothing qualifies.
 */
export function instantPick(
  quotes: readonly DemoQuote[],
  maxCents: number,
  fromSec = 0,
  windowSec: number = TIMING.expireAt,
): DemoPick | null {
  const first = [...quotes]
    .filter((q) => q.priceCents <= maxCents && q.arrivesAtSec <= windowSec)
    .sort((a, b) => a.arrivesAtSec - b.arrivesAtSec)[0];
  return first ? { quoteId: first.id, atSec: Math.max(first.arrivesAtSec, fromSec) } : null;
}

/**
 * Believable demo answers (RSOS-116): each question's first option most of the time, so a few
 * demo requests carry tags such as "Flatbed needed" or "No spare". Never the 911 answers.
 */
function demoAnswers(service: string, r: () => number): Record<string, string> {
  const a: Record<string, string> = { safety: r() < 0.7 ? "safe" : "shoulder", when: "now" };
  for (const q of SERVICE_QUESTIONS[service] ?? []) {
    if (q.kind !== "chips" || !q.options?.length || q.showIf) continue;
    if (!q.required && r() < 0.5) continue;
    const pick = r() < 0.7 ? q.options[0]! : q.options[Math.floor(r() * q.options.length)]!;
    a[q.id] = q.id === "childInside" ? "no" : pick;
  }
  return a;
}
