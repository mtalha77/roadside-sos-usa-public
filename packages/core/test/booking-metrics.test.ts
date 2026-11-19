import { describe, expect, it } from "vitest";
import {
  callsFunnel,
  demoMetricData,
  dropOff,
  type FlowEvent,
  funnelBy,
  mainFunnel,
  type MetricCall,
  type MetricRequest,
  northStar,
  northStarBy,
  percentile,
  realOnly,
  stepRows,
} from "../src/booking-metrics";

// RSOS-111: booking speed and funnel analytics, computed on seeded rows. Markets are A and B.
const T0 = Date.UTC(2026, 10, 18, 12);
const S = 1000;

const req = (id: string, o: Partial<MetricRequest>): MetricRequest => ({
  id,
  market: "market-a",
  source: "google_ads",
  service: "flat-tire",
  device: "mobile",
  channel: "website",
  mode: "compare",
  demo: false,
  landingSec: null,
  submittedAt: T0,
  quotedAt: null,
  bookedAt: null,
  completedAt: null,
  ...o,
});

// Seven real requests, one demo one and one call-in.
const REQUESTS: MetricRequest[] = [
  req("r1", {
    landingSec: 40,
    quotedAt: T0 + 60 * S,
    bookedAt: T0 + 120 * S,
    completedAt: T0 + 3_600 * S,
  }),
  req("r2", { landingSec: 55, quotedAt: T0 + 50 * S, bookedAt: T0 + 180 * S, mode: "instant" }),
  req("r3", { landingSec: 75, quotedAt: T0 + 90 * S, bookedAt: T0 + 400 * S, source: "organic" }),
  req("r4", { landingSec: 30, quotedAt: T0 + 70 * S, device: "desktop" }),
  req("r5", {
    landingSec: 90,
    market: "market-b",
    quotedAt: T0 + 40 * S,
    bookedAt: T0 + 60 * S,
    mode: "instant",
    completedAt: T0 + 4_000 * S,
  }),
  req("r6", { landingSec: 20, market: "market-b" }),
  req("r7", {
    landingSec: 65,
    market: "market-b",
    service: "jump-start",
    quotedAt: T0 + 30 * S,
    bookedAt: T0 + 240 * S,
  }),
  req("d1", { demo: true, landingSec: 5, quotedAt: T0 + 5 * S, bookedAt: T0 + 10 * S }),
  req("p1", { channel: "phone", source: "google_ads", bookedAt: T0 + 300 * S }),
];

const ev = (
  session: string,
  event: FlowEvent["event"],
  step: string,
  field: string | null = null,
  at = T0,
): FlowEvent => ({
  session,
  event,
  step,
  field,
  market: "market-a",
  source: "google_ads",
  device: "mobile",
  demo: false,
  at,
});

// Ten flow sessions: 7 submit; one leaves on problem, one on location (address), one on details
// (phone, after touching the name first).
const SUBMITTED = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"].flatMap((s) => [
  ev(s, "step", "problem"),
  ev(s, "step", "location"),
  ev(s, "step", "details"),
  ev(s, "submitted", "details"),
]);
const EVENTS: FlowEvent[] = [
  ...SUBMITTED,
  ev("s8", "step", "problem"),
  ev("s9", "step", "problem"),
  ev("s9", "step", "location"),
  ev("s9", "left", "location", "address"),
  ev("s10", "step", "problem"),
  ev("s10", "step", "location"),
  ev("s10", "step", "details"),
  ev("s10", "left", "details", "name", T0),
  ev("s10", "left", "details", "phone", T0 + 5 * S),
  { ...ev("demo-1", "step", "problem"), demo: true },
];

describe("percentile", () => {
  it("uses the nearest rank and handles empty lists", () => {
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([5], 0.9)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9);
    expect(percentile([30, 10, 20], 0.5)).toBe(20);
  });
});

describe("north-star timings", () => {
  const rows = realOnly(REQUESTS);
  const day = northStar(rows, T0, T0 + 86_400_000);

  it("landing to submitted: website requests only, median and 90th percentile", () => {
    // 20, 30, 40, 55, 65, 75, 90 seconds.
    expect(day.landingToSubmit).toEqual({ count: 7, median: 55, p90: 90, target: 60 });
  });

  it("submitted to booked: every booked request (calls included), in seconds", () => {
    // 60, 120, 180, 240, 300 (the call), 400 seconds.
    expect(day.submitToBooked).toEqual({ count: 6, median: 180, p90: 400, target: 300 });
  });

  it("only requests submitted in the range count", () => {
    expect(northStar(rows, T0 + 1, T0 + 86_400_000).submitToBooked.count).toBe(0);
  });

  it("groups by market and by source", () => {
    const byMarket = northStarBy(rows, "market", T0, T0 + 86_400_000);
    expect(byMarket.map((g) => [g.key, g.submitToBooked.count, g.submitToBooked.median])).toEqual([
      ["market-a", 4, 180],
      ["market-b", 2, 60],
    ]);
    const bySource = northStarBy(rows, "source", T0, T0 + 86_400_000);
    expect(bySource.map((g) => g.key)).toEqual(["google_ads", "organic"]);
  });

  it("leaves demo rows out unless they are included", () => {
    // Raw rows still hold the demo request; realOnly leaves it out.
    expect(northStar(REQUESTS, T0, T0 + 86_400_000).submitToBooked.count).toBe(7);
    expect(northStar(realOnly(REQUESTS, false), T0, T0 + 86_400_000).submitToBooked.count).toBe(6);
    const withDemo = realOnly(REQUESTS, true);
    expect(northStar(withDemo, T0, T0 + 86_400_000).submitToBooked.count).toBe(7);
  });
});

describe("main funnel", () => {
  const funnel = mainFunnel(realOnly(REQUESTS), realOnly(EVENTS), 40);

  it("counts every step and its conversion", () => {
    expect(funnel.map((r) => [r.step, r.count])).toEqual([
      ["visits", 40],
      ["started", 10],
      ["submitted", 7],
      ["quoted", 6],
      ["booked", 5],
      ["completed", 2],
    ]);
    expect(funnel[1]!.conversion).toBeCloseTo(0.25);
    expect(funnel[2]!.dropOff).toBeCloseTo(0.3);
    expect(funnel[0]!.conversion).toBeNull();
  });

  it("never lets a step pass the one before it", () => {
    const rows = stepRows(["a", "b"], { a: 2, b: 5 });
    expect(rows[1]).toEqual({ step: "b", count: 2, conversion: 1, dropOff: 0 });
  });

  it("splits by Compare quotes and Instant book", () => {
    const byMode = funnelBy(realOnly(REQUESTS), "mode");
    expect(byMode.map((g) => [g.key, g.rows.map((r) => r.count), g.bookedShare])).toEqual([
      ["compare", [5, 4, 3, 1], 0.6],
      ["instant", [2, 2, 2, 1], 1],
    ]);
  });

  it("splits by market, source, service and device", () => {
    expect(funnelBy(realOnly(REQUESTS), "market").map((g) => [g.key, g.rows[0]!.count])).toEqual([
      ["market-a", 4],
      ["market-b", 3],
    ]);
    expect(funnelBy(realOnly(REQUESTS), "source").map((g) => g.key)).toEqual([
      "google_ads",
      "organic",
    ]);
    expect(funnelBy(realOnly(REQUESTS), "service").map((g) => [g.key, g.rows[2]!.count])).toEqual([
      ["flat-tire", 4],
      ["jump-start", 1],
    ]);
    expect(funnelBy(realOnly(REQUESTS), "device").map((g) => [g.key, g.rows[0]!.count])).toEqual([
      ["mobile", 6],
      ["desktop", 1],
    ]);
  });
});

describe("calls funnel", () => {
  const call = (id: string, o: Partial<MetricCall>): MetricCall => ({
    id,
    market: "market-a",
    source: "google_ads",
    demo: false,
    answered: false,
    qualified: false,
    booked: false,
    completed: false,
    ...o,
  });
  it("calls → answered → qualified → booked → completed", () => {
    const calls = [
      call("c1", { answered: true, qualified: true, booked: true, completed: true }),
      call("c2", { answered: true, qualified: true, booked: true }),
      call("c3", { answered: true, qualified: true }),
      call("c4", { answered: true }),
      call("c5", {}),
      call("c6", { demo: true, answered: true }),
      // Inconsistent data (booked without an answer) does not count as booked.
      call("c7", { booked: true }),
    ];
    expect(callsFunnel(realOnly(calls)).map((r) => [r.step, r.count])).toEqual([
      ["calls", 6],
      ["answered", 4],
      ["qualified", 3],
      ["booked", 2],
      ["completed", 1],
    ]);
  });
});

describe("where people drop", () => {
  it("per step: who reached it, who left there, and the field touched last", () => {
    expect(dropOff(realOnly(EVENTS))).toEqual([
      { step: "problem", reached: 10, left: 1, share: 0.1, topField: null },
      { step: "location", reached: 9, left: 1, share: 1 / 9, topField: "address" },
      { step: "details", reached: 8, left: 1, share: 0.125, topField: "phone" },
    ]);
  });
});

describe("demo data", () => {
  it("is labelled demo, repeatable and consistent", () => {
    const opts = {
      markets: ["market-a", "market-b"],
      services: ["flat-tire"],
      from: T0,
      to: T0 + 7 * 86_400_000,
    };
    const a = demoMetricData(opts);
    const b = demoMetricData(opts);
    expect(a).toEqual(b);
    expect(a.requests.length).toBeGreaterThan(50);
    expect(a.requests.every((r) => r.demo)).toBe(true);
    expect(realOnly(a.requests)).toHaveLength(0);
    const f = mainFunnel(a.requests, a.events, a.visits);
    for (let i = 1; i < f.length; i++) expect(f[i]!.count).toBeLessThanOrEqual(f[i - 1]!.count);
    const speed = northStar(a.requests, T0, opts.to);
    expect(speed.landingToSubmit.median).toBeLessThan(80);
    expect(dropOff(a.events).every((d) => d.reached > 0)).toBe(true);
    expect(callsFunnel(a.calls)[0]!.count).toBeGreaterThan(0);
  });
});
