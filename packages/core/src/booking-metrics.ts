/**
 * Booking speed and funnel analytics (RSOS-111). Pure functions over plain rows so the admin
 * pages and the unit tests compute the same numbers. Times are epoch milliseconds.
 *
 * North-star metrics:
 * - landing to request submitted (target under 60 seconds),
 * - request submitted to provider booked (target under 5 minutes).
 */
export const TARGETS = { landingToSubmitSec: 60, submitToBookedSec: 300 } as const;

/** The Get Help steps, in order (the website's `STEPS`). */
export const FLOW_STEPS = ["problem", "location", "details"] as const;
export type FlowStep = (typeof FLOW_STEPS)[number];

export type BookingMode = "compare" | "instant";
export type Device = "mobile" | "desktop";

/** A request as the analytics read it. */
export type MetricRequest = {
  id: string;
  market: string;
  source: string;
  service: string;
  device: Device | null;
  channel: "website" | "phone";
  mode: BookingMode;
  demo: boolean;
  /** Seconds from landing on the website to submitting (website requests that carry it). */
  landingSec: number | null;
  submittedAt: number;
  quotedAt: number | null;
  bookedAt: number | null;
  completedAt: number | null;
};

/** One Get Help screen seen, left, or the request submitted, per visitor session. */
export type FlowEvent = {
  session: string;
  event: "step" | "left" | "submitted";
  step: string;
  field: string | null;
  market: string | null;
  source: string | null;
  device: Device | null;
  demo: boolean;
  at: number;
};

export type MetricCall = {
  id: string;
  market: string;
  source: string;
  demo: boolean;
  answered: boolean;
  /** A real conversation: at least 30 seconds, or it became a request. */
  qualified: boolean;
  booked: boolean;
  completed: boolean;
};

/** Demo rows are left out unless the "Include demo data" choice is on (staging only). */
export const realOnly = <T extends { demo: boolean }>(rows: T[], includeDemo = false): T[] =>
  includeDemo ? rows : rows.filter((r) => !r.demo);

/** Nearest-rank percentile (p from 0 to 1) of a list of numbers; null when empty. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(p * sorted.length)));
  return sorted[rank - 1]!;
}

export type Speed = { count: number; median: number | null; p90: number | null; target: number };

const speed = (values: number[], target: number): Speed => ({
  count: values.length,
  median: percentile(values, 0.5),
  p90: percentile(values, 0.9),
  target,
});

/** Both north-star timings (seconds) for requests submitted in [from, to). */
export function northStar(
  requests: MetricRequest[],
  from: number,
  to: number,
): { landingToSubmit: Speed; submitToBooked: Speed } {
  const inRange = requests.filter((r) => r.submittedAt >= from && r.submittedAt < to);
  return {
    landingToSubmit: speed(
      inRange.flatMap((r) =>
        r.channel === "website" && r.landingSec !== null && r.landingSec >= 0 ? [r.landingSec] : [],
      ),
      TARGETS.landingToSubmitSec,
    ),
    submitToBooked: speed(
      inRange.flatMap((r) =>
        r.bookedAt !== null && r.bookedAt >= r.submittedAt
          ? [Math.round((r.bookedAt - r.submittedAt) / 1000)]
          : [],
      ),
      TARGETS.submitToBookedSec,
    ),
  };
}

/** North-star timings grouped by a key (market or source), largest groups first. */
export function northStarBy(
  requests: MetricRequest[],
  key: "market" | "source",
  from: number,
  to: number,
): { key: string; landingToSubmit: Speed; submitToBooked: Speed }[] {
  const groups = new Map<string, MetricRequest[]>();
  for (const r of requests) groups.set(r[key], [...(groups.get(r[key]) ?? []), r]);
  return [...groups.entries()]
    .map(([k, rows]) => ({ key: k, ...northStar(rows, from, to) }))
    .filter((g) => g.landingToSubmit.count + g.submitToBooked.count > 0)
    .sort((a, b) => b.submitToBooked.count - a.submitToBooked.count || a.key.localeCompare(b.key));
}

export const MAIN_STEPS = [
  "visits",
  "started",
  "submitted",
  "quoted",
  "booked",
  "completed",
] as const;
export type MainStep = (typeof MAIN_STEPS)[number];
export type StepRow = {
  step: string;
  count: number;
  /** Conversion from the previous step, 0 to 1 (null for the first step or after a zero). */
  conversion: number | null;
  /** Share lost since the previous step, 0 to 1. */
  dropOff: number | null;
};

/** Counts to rows; a step never passes the one before it (bad data is capped, not shown >100%). */
export function stepRows(steps: readonly string[], counts: Record<string, number>): StepRow[] {
  let prev: number | null = null;
  return steps.map((step) => {
    const raw = Math.max(0, Math.round(counts[step] ?? 0));
    const count = prev === null ? raw : Math.min(raw, prev);
    const conversion = prev === null || prev === 0 ? null : count / prev;
    prev = count;
    return { step, count, conversion, dropOff: conversion === null ? null : 1 - conversion };
  });
}

/**
 * The main funnel: visits → started request → submitted → first quote received → booked →
 * completed. Website requests only (a call has no visit or started step). `visits` comes from the
 * visit counter; `started` counts flow sessions that saw the first step, plus submitted requests
 * without a session (recorded before RSOS-111).
 */
export function mainFunnel(
  requests: MetricRequest[],
  events: FlowEvent[],
  visits: number,
): StepRow[] {
  const web = requests.filter((r) => r.channel === "website");
  const sessions = new Set(events.filter((e) => e.event === "step").map((e) => e.session));
  const submittedSessions = new Set(
    events.filter((e) => e.event === "submitted").map((e) => e.session),
  );
  const withoutSession = Math.max(0, web.length - submittedSessions.size);
  return stepRows(MAIN_STEPS, {
    visits,
    started: sessions.size + withoutSession,
    submitted: web.length,
    quoted: web.filter((r) => r.quotedAt !== null || r.bookedAt !== null).length,
    booked: web.filter((r) => r.bookedAt !== null).length,
    completed: web.filter((r) => r.completedAt !== null).length,
  });
}

/** From submitted on, the funnel per group: market, source, service, device or booking mode. */
export const REQUEST_STEPS = ["submitted", "quoted", "booked", "completed"] as const;
export function funnelBy(
  requests: MetricRequest[],
  key: "market" | "source" | "service" | "device" | "mode",
): { key: string; rows: StepRow[]; bookedShare: number | null }[] {
  const groups = new Map<string, MetricRequest[]>();
  for (const r of requests.filter((x) => x.channel === "website")) {
    const k = String(r[key] ?? "unknown");
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([k, rows]) => {
      const counts = {
        submitted: rows.length,
        quoted: rows.filter((r) => r.quotedAt !== null || r.bookedAt !== null).length,
        booked: rows.filter((r) => r.bookedAt !== null).length,
        completed: rows.filter((r) => r.completedAt !== null).length,
      };
      return {
        key: k,
        rows: stepRows(REQUEST_STEPS, counts),
        bookedShare: counts.submitted ? counts.booked / counts.submitted : null,
      };
    })
    .sort((a, b) => b.rows[0]!.count - a.rows[0]!.count || a.key.localeCompare(b.key));
}

/** The calls funnel: calls → answered → qualified → booked → completed. */
export const CALL_STEPS = ["calls", "answered", "qualified", "booked", "completed"] as const;
export function callsFunnel(calls: MetricCall[]): StepRow[] {
  return stepRows(CALL_STEPS, {
    calls: calls.length,
    answered: calls.filter((c) => c.answered).length,
    qualified: calls.filter((c) => c.answered && c.qualified).length,
    booked: calls.filter((c) => c.answered && c.qualified && c.booked).length,
    completed: calls.filter((c) => c.answered && c.qualified && c.booked && c.completed).length,
  });
}

export type DropRow = {
  step: FlowStep;
  /** Sessions that saw this step. */
  reached: number;
  /** Sessions whose last step was this one and that never submitted. */
  left: number;
  /** left / reached, 0 to 1 (null when nobody reached it). */
  share: number | null;
  /** The field most often touched last by those who left here (from the leave beacon). */
  topField: string | null;
};

/** Where people drop: per Get Help step, the share who leave and their most common last field. */
export function dropOff(events: FlowEvent[]): DropRow[] {
  const bySession = new Map<string, FlowEvent[]>();
  for (const e of events) bySession.set(e.session, [...(bySession.get(e.session) ?? []), e]);
  const reached = new Map<string, number>();
  const left = new Map<string, number>();
  const fields = new Map<string, Map<string, number>>();
  const order = (s: string) => FLOW_STEPS.indexOf(s as FlowStep);
  for (const list of bySession.values()) {
    const seen = [...new Set(list.filter((e) => e.event === "step").map((e) => e.step))].filter(
      (s) => order(s) >= 0,
    );
    for (const s of seen) reached.set(s, (reached.get(s) ?? 0) + 1);
    if (!seen.length || list.some((e) => e.event === "submitted")) continue;
    const last = seen.reduce((a, b) => (order(b) > order(a) ? b : a));
    left.set(last, (left.get(last) ?? 0) + 1);
    // The latest leave beacon on that step names the field touched last.
    const beacon = list
      .filter((e) => e.event === "left" && e.step === last && e.field)
      .sort((a, b) => b.at - a.at)[0];
    if (beacon?.field) {
      const f = fields.get(last) ?? new Map<string, number>();
      f.set(beacon.field, (f.get(beacon.field) ?? 0) + 1);
      fields.set(last, f);
    }
  }
  return FLOW_STEPS.map((step) => {
    const r = reached.get(step) ?? 0;
    const l = left.get(step) ?? 0;
    const top = [...(fields.get(step)?.entries() ?? [])].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0];
    return { step, reached: r, left: l, share: r ? l / r : null, topField: top?.[0] ?? null };
  });
}

/**
 * Demo data for the analytics panels (staging and previews only, always labelled Demo): a seeded,
 * believable mix of requests, flow sessions and calls between `from` and `to`. The same inputs
 * always give the same rows.
 */
export function demoMetricData(opts: {
  markets: string[];
  services: string[];
  from: number;
  to: number;
  perDay?: number;
}): { requests: MetricRequest[]; events: FlowEvent[]; calls: MetricCall[]; visits: number } {
  const SOURCES = ["google_ads", "google_ads", "google_ads", "organic", "direct", "meta"];
  let seed = 0x2f6b3a1d ^ Math.floor(opts.from / 86_400_000);
  const rnd = () => {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) | 0;
    return ((seed ^ (seed >>> 13)) >>> 0) / 4_294_967_296;
  };
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  const requests: MetricRequest[] = [];
  const events: FlowEvent[] = [];
  const calls: MetricCall[] = [];
  const days = Math.max(1, (opts.to - opts.from) / 86_400_000);
  const sessions = Math.round(days * (opts.perDay ?? 24) * 1.9);
  for (let i = 0; i < sessions && opts.markets.length; i++) {
    const at = opts.from + rnd() * (opts.to - opts.from);
    const market = pick(opts.markets);
    const source = pick(SOURCES);
    const device: Device = rnd() < 0.82 ? "mobile" : "desktop";
    const session = `demo-${i}`;
    const base = { session, field: null, market, source, device, demo: true };
    // Most visitors finish; some leave on location (address typing) or details (phone).
    const reach = rnd() < 0.08 ? 1 : rnd() < 0.2 ? 2 : 3;
    const submitted = reach === 3 && rnd() < 0.82;
    FLOW_STEPS.slice(0, reach).forEach((step, n) =>
      events.push({ ...base, event: "step", step, at: at + n * 12_000 }),
    );
    if (!submitted) {
      const step = FLOW_STEPS[reach - 1]!;
      const fields: Record<FlowStep, string[]> = {
        problem: ["service"],
        location: ["address", "address", "gps", "destAddress"],
        details: ["phone", "phone", "name", "make"],
      };
      events.push({ ...base, event: "left", step, field: pick(fields[step]), at: at + 40_000 });
      continue;
    }
    const landingSec = Math.round(25 + rnd() * 50 + (device === "desktop" ? 10 : 0));
    const submittedAt = at + landingSec * 1000;
    events.push({ ...base, event: "submitted", step: "details", at: submittedAt });
    const mode: BookingMode = rnd() < 0.33 ? "instant" : "compare";
    const quotedAt = rnd() < 0.93 ? submittedAt + (30 + rnd() * 90) * 1000 : null;
    const booked = quotedAt !== null && rnd() < (mode === "instant" ? 0.9 : 0.76);
    const bookedAt = booked
      ? quotedAt + (mode === "instant" ? 1 + rnd() * 20 : 30 + rnd() * 200) * 1000
      : null;
    requests.push({
      id: `demo-r${i}`,
      market,
      source,
      service: pick(opts.services),
      device,
      channel: "website",
      mode,
      demo: true,
      landingSec,
      submittedAt,
      quotedAt,
      bookedAt,
      completedAt: bookedAt !== null && rnd() < 0.9 ? bookedAt + 3_600_000 : null,
    });
  }
  const callCount = Math.round(days * (opts.perDay ?? 24) * 0.25);
  for (let i = 0; i < callCount && opts.markets.length; i++) {
    const answered = rnd() < 0.85;
    const qualified = answered && rnd() < 0.7;
    const booked = qualified && rnd() < 0.6;
    calls.push({
      id: `demo-c${i}`,
      market: pick(opts.markets),
      source: pick(SOURCES),
      demo: true,
      answered,
      qualified,
      booked,
      completed: booked && rnd() < 0.9,
    });
  }
  const started = new Set(events.map((e) => e.session)).size;
  return { requests, events, calls, visits: Math.round(started * 3.4) };
}
