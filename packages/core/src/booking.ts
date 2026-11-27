/**
 * Booking commitment (RSOS-117): the rules shared by the website (customer tracking), the provider
 * portal (the 4-step job screen) and the admin. The database applies the same rules
 * (supabase/migrations/20261127010000_booking_commitment.sql); these functions let the screens
 * show the right thing without a round trip, and the unit tests pin the rules down.
 */

/** Platform-wide rules (admin-editable; defaults from the spec). */
export type BookingRules = {
  chargeAfterMinutes: number;
  lateRefundMinutes: number;
  backupAfterMinutes: number;
  arrivalRadiusM: number;
  codeMaxTries: number;
  noShowWaitMinutes: number;
  noShowReleaseLimit: number;
  shortJobMinutes: number;
  feeAfterNoShows: number;
  blockAfterNoShows: number;
};

export const DEFAULT_BOOKING_RULES: BookingRules = {
  chargeAfterMinutes: 60,
  lateRefundMinutes: 30,
  backupAfterMinutes: 15,
  arrivalRadiusM: 200,
  codeMaxTries: 5,
  noShowWaitMinutes: 15,
  noShowReleaseLimit: 3,
  shortJobMinutes: 5,
  feeAfterNoShows: 2,
  blockAfterNoShows: 3,
};

/** The customer booking fee in a market (off by default everywhere). */
export type BookingFee = { enabled: boolean; amountCents: number; freeCancelSeconds: number };
export const BOOKING_FEE_OFF: BookingFee = {
  enabled: false,
  amountCents: 500,
  freeCancelSeconds: 120,
};

const MIN = 60_000;

/** Distance in metres between two points (haversine; good to a few metres at these ranges). */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "Arrived" is set automatically, or tapped, only within the arrival radius of the customer. */
export function canMarkArrived(
  provider: { lat: number; lng: number } | null,
  customer: { lat: number; lng: number },
  rules: Pick<BookingRules, "arrivalRadiusM"> = DEFAULT_BOOKING_RULES,
): boolean {
  return provider !== null && distanceMeters(provider, customer) <= rules.arrivalRadiusM;
}

/** Whether the customer must pay the booking fee: on in the market, or 2+ recent no-shows. */
export type CustomerStanding = "ok" | "fee_required" | "blocked";
export function customerStanding(
  recentNoShows: number,
  rules: Pick<BookingRules, "feeAfterNoShows" | "blockAfterNoShows"> = DEFAULT_BOOKING_RULES,
): CustomerStanding {
  if (recentNoShows >= rules.blockAfterNoShows) return "blocked";
  if (recentNoShows >= rules.feeAfterNoShows) return "fee_required";
  return "ok";
}

export function bookingFeeDue(fee: BookingFee, standing: CustomerStanding): number | null {
  if (standing === "blocked") return null;
  return fee.enabled || standing === "fee_required" ? fee.amountCents : 0;
}

/** Customer cancels: inside the free window the booking fee comes back; after it, it is kept. */
export function cancelOutcome(
  pickedAt: number,
  cancelledAt: number,
  fee: Pick<BookingFee, "freeCancelSeconds">,
  arrived: boolean,
): { providerFee: "release" | "charge"; bookingFee: "refund" | "keep"; lateCancel: boolean } {
  const free = cancelledAt - pickedAt <= fee.freeCancelSeconds * 1000;
  return {
    providerFee: arrived ? "charge" : "release",
    bookingFee: free ? "refund" : "keep",
    lateCancel: !free,
  };
}

/** The "Find me another provider" button: 15 minutes past the promised arrival, not arrived. */
export function canRequestBackup(
  promisedAt: number,
  now: number,
  arrived: boolean,
  rules: Pick<BookingRules, "backupAfterMinutes"> = DEFAULT_BOOKING_RULES,
): boolean {
  return !arrived && now > promisedAt + rules.backupAfterMinutes * MIN;
}

/** Automatic booking fee refund reasons (null when none applies). */
export type RefundReason = "provider_cancelled" | "provider_late" | "no_backup_found" | "complaint";
export function bookingFeeRefund(e: {
  providerCancelled?: boolean;
  promisedAt: number;
  arrivedAt: number | null;
  now: number;
  backupRequestedAt?: number | null;
  newProviderFound?: boolean;
  complaintApproved?: boolean;
  rules?: Pick<BookingRules, "lateRefundMinutes">;
}): RefundReason | null {
  const late = (e.rules ?? DEFAULT_BOOKING_RULES).lateRefundMinutes * MIN;
  if (e.providerCancelled) return "provider_cancelled";
  if (e.complaintApproved) return "complaint";
  if (e.backupRequestedAt != null && !e.newProviderFound && e.now > e.backupRequestedAt + late)
    return "no_backup_found";
  if (e.arrivedAt === null && e.now > e.promisedAt + late) return "provider_late";
  return null;
}

/** What happens to the reserved provider fee. */
export type HoldEvent =
  | { kind: "code" }
  | { kind: "gps_arrival" }
  | { kind: "customer_fixed" }
  | { kind: "timer"; minutesSincePick: number }
  | { kind: "customer_cancelled_before_arrival" }
  | { kind: "provider_cancelled" }
  | {
      kind: "no_show";
      gpsAtLocation: boolean;
      customerResponded: boolean;
      releasesThisMonth: number;
    };

export function holdOutcome(
  e: HoldEvent,
  rules: Pick<BookingRules, "chargeAfterMinutes" | "noShowReleaseLimit"> = DEFAULT_BOOKING_RULES,
): "charge" | "release" | "review" | "hold" {
  switch (e.kind) {
    case "code":
    case "gps_arrival":
    case "customer_fixed":
      return "charge";
    case "timer":
      return e.minutesSincePick >= rules.chargeAfterMinutes ? "charge" : "hold";
    case "customer_cancelled_before_arrival":
    case "provider_cancelled":
      return "release";
    case "no_show":
      if (!e.gpsAtLocation || e.customerResponded) return "charge";
      return e.releasesThisMonth < rules.noShowReleaseLimit ? "release" : "review";
  }
}

/** A completion code attempt. 5 wrong tries lock it (and notify the admin). */
export function codeAttempt(
  code: string,
  entered: string,
  triesSoFar: number,
  rules: Pick<BookingRules, "codeMaxTries"> = DEFAULT_BOOKING_RULES,
): { result: "ok" | "wrong" | "locked"; tries: number } {
  if (triesSoFar >= rules.codeMaxTries) return { result: "locked", tries: triesSoFar };
  if (entered.trim() === code) return { result: "ok", tries: triesSoFar };
  const tries = triesSoFar + 1;
  return { result: tries >= rules.codeMaxTries ? "locked" : "wrong", tries };
}

/** A 4-digit code from a seed (demo jobs; real codes come from the database). */
export function demoCompletionCode(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return String((h >>> 0) % 10_000).padStart(4, "0");
}

export const BOOKING_FLAGS = [
  "done_without_arrival",
  "short_job",
  "high_cancel_rate",
  "high_no_show_rate",
  "same_device",
  "many_not_available",
  "code_locked",
  "cancel_then_fixed",
  "customer_dispute",
  "no_show_review",
] as const;
export type BookingFlag = (typeof BOOKING_FLAGS)[number];

/** Warning signs raised when a job is finished. */
export function completionFlags(
  j: {
    arrivedAt: number | null;
    doneAt: number;
    customerDevice: string | null;
    providerDevice: string | null;
    notAvailableLast30Days: number;
    viaNotAvailable: boolean;
  },
  rules: Pick<BookingRules, "shortJobMinutes"> = DEFAULT_BOOKING_RULES,
): BookingFlag[] {
  const flags: BookingFlag[] = [];
  if (j.arrivedAt === null) flags.push("done_without_arrival");
  else if (j.doneAt - j.arrivedAt < rules.shortJobMinutes * MIN) flags.push("short_job");
  if (j.customerDevice && j.customerDevice === j.providerDevice) flags.push("same_device");
  if (j.viaNotAvailable && j.notAvailableLast30Days >= 3) flags.push("many_not_available");
  return flags;
}

/** Spot checks: 5% of a week's finished jobs, at least one when there were any. */
export function spotCheckCount(finishedJobs: number, pct: number): number {
  if (finishedJobs <= 0 || pct <= 0) return 0;
  return Math.min(finishedJobs, Math.max(1, Math.ceil((finishedJobs * pct) / 100)));
}
