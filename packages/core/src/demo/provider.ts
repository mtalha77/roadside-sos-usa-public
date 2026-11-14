import { demoMarkets, demoPeople } from "@rsos/config/demo-fixtures";
import {
  type DemoRequest,
  type DemoState,
  demoProviders,
  demoState,
  demoStream,
  type PriceRanges,
  rng,
  seedFrom,
} from "./engine";

export type PortalJob = {
  id: string;
  token: string;
  code: string;
  serviceSlug: string;
  area: string;
  driverName: string;
  vehicle: string;
  priceCents: number;
  feeCents: number;
  status: "active" | "won" | "lost" | "cancelled";
  stage: DemoState["stage"];
  at: number;
  rating: number | null;
  operator: string;
};
export type PortalTxn = {
  id: string;
  at: number;
  kind: "fee" | "top_up" | "credit" | "plan";
  amountCents: number;
  jobCode: string | null;
};
export type PortalMember = {
  id: string;
  name: string;
  role: "owner" | "manager" | "operator";
  truck: string;
  online: boolean;
  lat: number;
  lng: number;
};

const DAY = 86_400_000;

/** Miles between two points (for distance and drive time on offers). */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * The provider portal's view of the shared demo stream: incoming offers (requests still taking
 * quotes in its market), live and past jobs, wallet history, team and weekly insights. Everything
 * is fictional and derived from the provider's slug and the wall clock.
 */
export function demoPortal(
  now: number,
  opts: {
    marketSlug: string;
    providerSlug?: string;
    ranges?: PriceRanges;
    fees?: Record<string, number>;
  },
) {
  const providers = demoProviders(opts.marketSlug);
  const provider = providers.find((p) => p.slug === opts.providerSlug) ?? providers[0]!;
  const fee = (svc: string) => opts.fees?.[svc] ?? 2250;
  const live = demoStream(now, {
    markets: [opts.marketSlug],
    ranges: opts.ranges ? { [opts.marketSlug]: opts.ranges } : undefined,
  });
  const withState = live.map((r) => ({ r, s: demoState(r, now) }));
  const offers = withState
    .filter(({ s }) => s.stage === "searching" || s.stage === "quoting")
    .map(({ r, s }) => {
      const miles = Math.round(milesBetween(provider.home, r.location) * 10) / 10;
      const mine = r.quotes.find((q) => q.provider.id === provider.id);
      return {
        request: r,
        stage: s.stage,
        miles,
        driveMinutes: Math.max(6, Math.round(miles * 2.2 + 4)),
        expiresAt: r.createdAt + 180_000,
        suggestedCents:
          mine?.priceCents ??
          Math.round(
            ((opts.ranges?.[r.serviceSlug]?.min ?? 6000) +
              (opts.ranges?.[r.serviceSlug]?.max ?? 12000)) /
              2 /
              500,
          ) * 500,
        feeCents: fee(r.serviceSlug),
        competitors: s.quotes.length,
      };
    });
  const r = rng(seedFrom(provider.slug));
  const team: PortalMember[] = Array.from({ length: Math.max(2, provider.trucks) }, (_, i) => {
    const area =
      demoMarkets[opts.marketSlug]!.areas[i % demoMarkets[opts.marketSlug]!.areas.length]!;
    return {
      id: `m${i}`,
      name:
        i === 0
          ? "Demo Owner"
          : `${demoPeople.first[(i * 3) % demoPeople.first.length]} ${demoPeople.lastInitial[i % demoPeople.lastInitial.length]}.`,
      role: i === 0 ? "owner" : i === 1 ? "manager" : "operator",
      truck: `Truck ${i + 1}`,
      online: i === 0 || r() > 0.35,
      lat: area.lat + (r() - 0.5) * 0.03,
      lng: area.lng + (r() - 0.5) * 0.03,
    };
  });
  const toJob = (
    req: DemoRequest,
    s: DemoState,
    status: PortalJob["status"],
    at: number,
  ): PortalJob => {
    const q = req.quotes.find((x) => x.provider.id === provider.id) ?? req.quotes[0]!;
    return {
      id: req.id,
      token: req.token,
      code: req.code,
      serviceSlug: req.serviceSlug,
      area: req.location.area,
      driverName: req.driver.name,
      vehicle: `${req.vehicle.color} ${req.vehicle.make} ${req.vehicle.model}`,
      priceCents: q.priceCents,
      feeCents: status === "won" || status === "active" ? fee(req.serviceSlug) : 0,
      status,
      stage: s.stage,
      at,
      rating: status === "won" ? (r() > 0.2 ? 5 : 4) : null,
      operator: team[Math.floor(r() * team.length)]!.name,
    };
  };
  const activeJobs = withState
    .filter(
      ({ s }) =>
        s.picked?.provider.id === provider.id &&
        ["picked", "en_route", "on_site"].includes(s.stage),
    )
    .map(({ r: req, s }) => toJob(req, s, "active", req.createdAt));
  // Past jobs: a stable history over the last 60 days.
  const history: PortalJob[] = [];
  for (let d = 0; d < 60; d++) {
    const perDay = 1 + Math.floor(r() * 4);
    for (let k = 0; k < perDay; k++) {
      const at = Math.floor(now / DAY) * DAY - d * DAY - Math.floor(r() * DAY);
      const req = demoStream(at, { markets: [opts.marketSlug] })[0];
      if (!req) continue;
      const roll = r();
      const status: PortalJob["status"] = roll < 0.55 ? "won" : roll < 0.9 ? "lost" : "cancelled";
      history.push(toJob(req, { ...demoState(req, at + 3_600_000) }, status, at));
    }
  }
  const won = history.filter((j) => j.status === "won");
  const txns: PortalTxn[] = [
    ...won.map((j) => ({
      id: `fee-${j.id}`,
      at: j.at,
      kind: "fee" as const,
      amountCents: -j.feeCents,
      jobCode: j.code,
    })),
    ...[5, 19, 33, 47].map((d, i) => ({
      id: `top-${i}`,
      at: now - d * DAY,
      kind: "top_up" as const,
      amountCents: [25000, 10000, 25000, 50000][i]!,
      jobCode: null,
    })),
    {
      id: "credit-0",
      at: now - 12 * DAY,
      kind: "credit" as const,
      amountCents: 2250,
      jobCode: won[3]?.code ?? null,
    },
  ].sort((a, b) => b.at - a.at);
  const today = history.filter((j) => j.at > now - (now % DAY));
  const weeks = Array.from({ length: 8 }, (_, w) => {
    const from = now - (w + 1) * 7 * DAY;
    const jobs = history.filter((j) => j.at >= from && j.at < from + 7 * DAY);
    const wins = jobs.filter((j) => j.status === "won");
    return {
      weekStart: from,
      quotes: jobs.length,
      wins: wins.length,
      jobValueCents: wins.reduce((a, j) => a + j.priceCents, 0),
      feesCents: wins.reduce((a, j) => a + j.feeCents, 0),
      replySec: 25 + Math.round(r() * 40),
      etaAccuracy: 0.82 + r() * 0.15,
    };
  }).reverse();
  return {
    provider,
    offers,
    activeJobs,
    history,
    txns,
    team,
    weeks,
    today: {
      requests: offers.length + today.length * 2,
      quotesSent: today.length,
      jobsWon: today.filter((j) => j.status === "won").length,
      jobValueCents: today.filter((j) => j.status === "won").reduce((a, j) => a + j.priceCents, 0),
      feesCents: today.filter((j) => j.status === "won").reduce((a, j) => a + j.feeCents, 0),
    },
  };
}
export type DemoPortal = ReturnType<typeof demoPortal>;
