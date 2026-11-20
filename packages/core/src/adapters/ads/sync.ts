import type { AdPlatform, Conversion, SpendRow } from "./types";

/**
 * The rules behind the ad sync jobs (RSOS-107), pure so they are tested end to end with fakes.
 */

/** "SA | Tow | Search": market ad code, service, campaign type. A manual mapping wins. */
export function mapCampaign(
  name: string,
  opts: {
    marketCodes: Record<string, string>;
    services: { slug: string; name: string }[];
    manual?: { marketId: string; service: string | null } | null;
  },
): { marketId: string; service: string | null } | null {
  if (opts.manual) return opts.manual;
  const parts = name.split("|").map((p) => p.trim());
  if (parts.length < 2) return null;
  const marketId = opts.marketCodes[parts[0]!.toUpperCase()];
  if (!marketId) return null;
  const want = parts[1]!.toLowerCase();
  const svc = opts.services.find(
    (s) => s.slug === want || s.name.toLowerCase() === want || s.slug.replace(/-/g, " ") === want,
  );
  return { marketId, service: svc?.slug ?? null };
}

export type DaySpend = {
  day: string;
  marketId: string;
  channel: AdPlatform;
  spendCents: number;
  source: "imported" | "manual";
};

/** Imported spend per day, market and channel; the manual form only fills days with no import. */
export function effectiveSpend(
  imported: { day: string; marketId: string; channel: AdPlatform; spendCents: number }[],
  manual: { day: string; marketId: string; channel: AdPlatform; spendCents: number }[],
): DaySpend[] {
  const key = (r: { day: string; marketId: string; channel: string }) =>
    `${r.day}|${r.marketId}|${r.channel}`;
  const out = new Map<string, DaySpend>();
  for (const r of imported) {
    const k = key(r);
    const prev = out.get(k);
    out.set(k, { ...r, spendCents: (prev?.spendCents ?? 0) + r.spendCents, source: "imported" });
  }
  for (const r of manual) if (!out.has(key(r))) out.set(key(r), { ...r, source: "manual" });
  return [...out.values()].sort(
    (a, b) => a.day.localeCompare(b.day) || a.marketId.localeCompare(b.marketId),
  );
}

/** Which platform a conversion goes back to: the one that produced the click. */
export function platformOf(
  c: Pick<Conversion, "gclid" | "gbraid" | "wbraid" | "fbclid" | "msclkid">,
): AdPlatform | null {
  if (c.gclid || c.gbraid || c.wbraid) return "google_ads";
  if (c.fbclid) return "meta";
  if (c.msclkid) return "microsoft_ads";
  return null;
}

export type UploadLog = {
  eventId: string;
  platform: AdPlatform;
  status: "sent" | "failed";
  attempts: number;
  nextAttemptAt: number | null;
};
export const MAX_ATTEMPTS = 8;

/** Retry backoff: 5 minutes, doubling, at most a day. */
export const backoffMs = (attempts: number) =>
  Math.min(24 * 3_600_000, 5 * 60_000 * 2 ** Math.max(0, attempts - 1));

/** The conversions to send now, per platform: never sent before, or failed and due for a retry. */
export function dueUploads(
  events: Conversion[],
  log: UploadLog[],
  now: number,
): Map<AdPlatform, Conversion[]> {
  const byKey = new Map(log.map((l) => [`${l.platform}|${l.eventId}`, l]));
  const out = new Map<AdPlatform, Conversion[]>();
  for (const e of events) {
    const p = platformOf(e);
    if (!p) continue;
    const l = byKey.get(`${p}|${e.eventId}`);
    if (l?.status === "sent") continue;
    if (l && (l.attempts >= MAX_ATTEMPTS || (l.nextAttemptAt !== null && l.nextAttemptAt > now)))
      continue;
    out.set(p, [...(out.get(p) ?? []), e]);
  }
  return out;
}

export type PauseRule = {
  enabled: boolean;
  minProviders: number;
  graceMinutes: number;
  startHour: number;
  endHour: number;
};
export type PauseState = { pausedServices: string[]; shortSince: Record<string, number> };

/**
 * Auto-pause, per market (every 5 minutes): a core service with fewer providers online than the
 * minimum, during ad hours, for longer than the grace period, pauses its campaigns; when providers
 * are back, they resume. Outside ad hours nothing changes. Off rules do nothing.
 */
export function autoPause(
  rule: PauseRule,
  online: Record<string, number>,
  coreServices: string[],
  state: PauseState,
  now: number,
  localHour: number,
): { pause: string[]; resume: string[]; state: PauseState } {
  const next: PauseState = {
    pausedServices: [...state.pausedServices],
    shortSince: { ...state.shortSince },
  };
  if (!rule.enabled) return { pause: [], resume: [], state: next };
  const inHours =
    rule.startHour <= rule.endHour
      ? localHour >= rule.startHour && localHour < rule.endHour
      : localHour >= rule.startHour || localHour < rule.endHour;
  const pause: string[] = [];
  const resume: string[] = [];
  for (const s of coreServices) {
    const short = (online[s] ?? 0) < rule.minProviders;
    const paused = next.pausedServices.includes(s);
    if (short) {
      next.shortSince[s] ??= now;
      if (inHours && !paused && now - next.shortSince[s]! >= rule.graceMinutes * 60_000) {
        pause.push(s);
        next.pausedServices.push(s);
      }
    } else {
      delete next.shortSince[s];
      if (paused) {
        resume.push(s);
        next.pausedServices = next.pausedServices.filter((x) => x !== s);
      }
    }
  }
  return { pause, resume, state: next };
}

export type DashboardInput = {
  spendCents: number;
  clicks: number;
  calls: number;
  qualifiedCalls: number;
  requests: number;
  assigned: number;
  completed: number;
  feesCents: number;
};

/** One dashboard row: the counts plus cost per request, cost per completed job and ROAS. */
export function dashboardRow(i: DashboardInput) {
  return {
    ...i,
    costPerRequestCents: i.requests ? Math.round(i.spendCents / i.requests) : null,
    costPerCompletedCents: i.completed ? Math.round(i.spendCents / i.completed) : null,
    /** Fees earned divided by spend (null without spend). */
    roas: i.spendCents ? i.feesCents / i.spendCents : null,
  };
}

/** Anything unusual for the owner's daily email. */
export function unusual(
  rows: (DashboardInput & { marketId: string })[],
  opts: { maxCostPerCompletedCents: number; failedJobs: string[] },
): {
  kind: "spend_no_requests" | "cost_per_job" | "failed_sync";
  marketId?: string;
  job?: string;
}[] {
  const out: {
    kind: "spend_no_requests" | "cost_per_job" | "failed_sync";
    marketId?: string;
    job?: string;
  }[] = [];
  for (const r of rows) {
    if (r.spendCents > 0 && r.requests === 0)
      out.push({ kind: "spend_no_requests", marketId: r.marketId });
    const cpj = r.completed ? r.spendCents / r.completed : null;
    if (cpj !== null && cpj > opts.maxCostPerCompletedCents)
      out.push({ kind: "cost_per_job", marketId: r.marketId });
  }
  for (const job of opts.failedJobs) out.push({ kind: "failed_sync", job });
  return out;
}

/** Sync health: consecutive failures per job (newest first in runs); alert at 3. */
export function syncHealth(runs: { job: string; ok: boolean; at: number }[]) {
  const jobs = new Map<string, { lastOk: number | null; failures: number; counting: boolean }>();
  for (const r of [...runs].sort((a, b) => b.at - a.at)) {
    const j = jobs.get(r.job) ?? { lastOk: null, failures: 0, counting: true };
    if (r.ok) {
      j.lastOk ??= r.at;
      j.counting = false;
    } else if (j.counting) j.failures += 1;
    jobs.set(r.job, j);
  }
  return [...jobs.entries()].map(([job, j]) => ({
    job,
    lastOk: j.lastOk,
    failures: j.failures,
    alert: j.failures >= 3,
  }));
}

export type { SpendRow };
