import { z } from "zod";

/**
 * Wallet bonus credits (RSOS-115). Two balances, shown separately everywhere:
 * - paid balance: provider top-ups (real money arrives in batch 6), never expires;
 * - bonus credit: admin grants and campaigns, expires per grant, never cash, spent first (oldest
 *   expiring grant first).
 * Pure rules shared by the database functions' tests, the admin and the provider portal. Money in
 * cents; times in epoch milliseconds.
 */
export const DAY_MS = 86_400_000;
export const DEFAULT_EXPIRY_DAYS = 60;
/** A refunded fee that was paid with credit comes back with its expiry or this, whichever later. */
export const REFUND_MIN_DAYS = 14;
export const REMINDER_DAYS = [7, 1] as const;

export const GRANT_REASONS = ["goodwill", "dispute", "promotion", "test", "other"] as const;
export type GrantReason = (typeof GRANT_REASONS)[number];
export const GRANT_SOURCES = [
  "signup",
  "manual",
  "campaign",
  "milestone",
  "referral",
  "reactivation",
  "refund",
] as const;
export type GrantSource = (typeof GRANT_SOURCES)[number];

export type Grant = {
  id: string;
  amountCents: number;
  remainingCents: number;
  expiresAt: number;
  /** Campaigns can allow paying the monthly plan with credit (off by default). */
  planAllowed: boolean;
  reversed: boolean;
};

export type Purpose = "fee" | "plan";

/** Grants usable now for a purpose, oldest expiry first (ties by id for a stable order). */
export function usableGrants(grants: Grant[], now: number, purpose: Purpose = "fee"): Grant[] {
  return grants
    .filter(
      (g) =>
        !g.reversed &&
        g.remainingCents > 0 &&
        g.expiresAt > now &&
        (purpose === "fee" || g.planAllowed),
    )
    .sort((a, b) => a.expiresAt - b.expiresAt || a.id.localeCompare(b.id));
}

export type Balances = {
  paidCents: number;
  bonusCents: number;
  totalCents: number;
  /** The soonest expiry among usable grants, or null. */
  nextExpiry: { at: number; cents: number } | null;
};

export function balances(paidCents: number, grants: Grant[], now: number): Balances {
  const usable = usableGrants(grants, now);
  const bonusCents = usable.reduce((n, g) => n + g.remainingCents, 0);
  const first = usable[0];
  return {
    paidCents,
    bonusCents,
    totalCents: paidCents + bonusCents,
    nextExpiry: first
      ? {
          at: first.expiresAt,
          cents: usable
            .filter((g) => g.expiresAt === first.expiresAt)
            .reduce((n, g) => n + g.remainingCents, 0),
        }
      : null,
  };
}

export type Spend = {
  /** Credit taken from each grant, in spend order. */
  fromGrants: { grantId: string; cents: number }[];
  bonusCents: number;
  paidCents: number;
  /** What the paid balance could not cover (the paid balance goes negative by this much). */
  shortCents: number;
};

/**
 * Pays an amount: bonus credit first (oldest expiring grant first), then the paid balance. Plans
 * use only grants that allow plans. The paid balance never goes below zero here; `shortCents`
 * says what is missing (the caller decides whether to refuse or let the balance go negative).
 */
export function spend(
  amountCents: number,
  paidCents: number,
  grants: Grant[],
  now: number,
  purpose: Purpose = "fee",
): Spend {
  let left = Math.max(0, Math.round(amountCents));
  const fromGrants: Spend["fromGrants"] = [];
  for (const g of usableGrants(grants, now, purpose)) {
    if (left === 0) break;
    const take = Math.min(left, g.remainingCents);
    fromGrants.push({ grantId: g.id, cents: take });
    left -= take;
  }
  const bonusCents = fromGrants.reduce((n, x) => n + x.cents, 0);
  const paid = Math.min(left, Math.max(0, paidCents));
  return { fromGrants, bonusCents, paidCents: paid, shortCents: left - paid };
}

/** The grants that expire at `now` with credit left, and how much each loses. */
export function expiring(grants: Grant[], now: number): { grantId: string; cents: number }[] {
  return grants
    .filter((g) => !g.reversed && g.remainingCents > 0 && g.expiresAt <= now)
    .map((g) => ({ grantId: g.id, cents: g.remainingCents }));
}

/** Grants that get an expiry reminder today: 7 days and 1 day before (by calendar day). */
export function reminderDue(grants: Grant[], now: number): { grantId: string; days: number }[] {
  return usableGrants(grants, now).flatMap((g) => {
    const days = Math.ceil((g.expiresAt - now) / DAY_MS);
    return (REMINDER_DAYS as readonly number[]).includes(days) ? [{ grantId: g.id, days }] : [];
  });
}

/**
 * A refunded job fee (cancelled job or approved dispute). The part paid with credit returns as
 * new credit that expires at the original grant's expiry or 14 days from now, whichever is later;
 * the paid part returns to the paid balance.
 */
export function refund(
  paidPart: number,
  creditParts: { grantId: string; cents: number; expiresAt: number }[],
  now: number,
): { paidCents: number; credits: { cents: number; expiresAt: number; fromGrant: string }[] } {
  return {
    paidCents: paidPart,
    credits: creditParts
      .filter((c) => c.cents > 0)
      .map((c) => ({
        cents: c.cents,
        expiresAt: Math.max(c.expiresAt, now + REFUND_MIN_DAYS * DAY_MS),
        fromGrant: c.grantId,
      })),
  };
}

/** Only unused credit can be reversed (for example fraud); used credit stays used. */
export function reversible(g: Grant, now: number): number {
  return g.reversed || g.expiresAt <= now ? 0 : g.remainingCents;
}

/** Approval limits per role (editable by the owner). Null means no limit. */
export const Limits = z.object({
  perGrantCents: z.number().int().min(0).nullable(),
  perCampaignCents: z.number().int().min(0).nullable(),
});
export type Limits = z.infer<typeof Limits>;
export const DEFAULT_LIMITS: Record<string, Limits> = {
  super_admin: { perGrantCents: null, perCampaignCents: null },
  ops_manager: { perGrantCents: 10_000, perCampaignCents: 100_000 },
};

/** Who may grant this much: "ok", "needs_owner" (above the role's limit) or "forbidden". */
export function canGrant(
  role: string,
  kind: "grant" | "campaign",
  cents: number,
  limits: Record<string, Limits> = DEFAULT_LIMITS,
): "ok" | "needs_owner" | "forbidden" {
  const l = limits[role];
  if (!l) return "forbidden";
  const max = kind === "grant" ? l.perGrantCents : l.perCampaignCents;
  return max === null || cents <= max ? "ok" : "needs_owner";
}

/**
 * A campaign's recipients within its budget: each gets the full amount, in the order given, until
 * the next one would pass the cap. The rest are listed as left out (never a partial grant).
 */
export function campaignPlan<T extends { id: string }>(
  recipients: T[],
  amountCents: number,
  budgetCents: number,
  alreadyGrantedCents = 0,
): { granted: T[]; leftOut: T[]; totalCents: number } {
  const room = Math.max(0, budgetCents - alreadyGrantedCents);
  const n = amountCents > 0 ? Math.min(recipients.length, Math.floor(room / amountCents)) : 0;
  return {
    granted: recipients.slice(0, n),
    leftOut: recipients.slice(n),
    totalCents: n * amountCents,
  };
}

export const IDENTIFIER_KINDS = [
  "ein",
  "phone",
  "insurance_policy",
  "bank_account",
  "device",
] as const;
export type IdentifierKind = (typeof IDENTIFIER_KINDS)[number];

/** Normalizes an identifier before hashing, so "12-3456789" and "123456789" match. */
export function normalizeIdentifier(kind: IdentifierKind, value: string): string {
  const v = value.trim().toLowerCase();
  if (kind === "ein" || kind === "phone" || kind === "bank_account") {
    const digits = v.replace(/\D/g, "");
    return kind === "phone" && digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits;
  }
  return v.replace(/[\s-]/g, "");
}

/** Other businesses that share any identifier with this one (one signup bonus per business). */
export function duplicates(
  mine: { kind: IdentifierKind; value: string }[],
  others: { providerId: string; kind: IdentifierKind; value: string }[],
): { providerId: string; kind: IdentifierKind }[] {
  const keys = new Set(
    mine
      .filter((m) => normalizeIdentifier(m.kind, m.value))
      .map((m) => `${m.kind}:${normalizeIdentifier(m.kind, m.value)}`),
  );
  const seen = new Set<string>();
  return others.flatMap((o) => {
    const k = `${o.kind}:${normalizeIdentifier(o.kind, o.value)}`;
    const id = `${o.providerId}:${o.kind}`;
    if (!keys.has(k) || seen.has(id)) return [];
    seen.add(id);
    return [{ providerId: o.providerId, kind: o.kind }];
  });
}

export type SignupRule = {
  enabled: boolean;
  amountCents: number;
  expiryDays: number;
  startsAt: number | null;
  endsAt: number | null;
};

/**
 * The signup bonus decision when a provider is approved: granted once per business, only on
 * approval (never at sign-up), only while the market's rule is on and in its dates. A duplicate
 * business is flagged for review instead of being silently refused.
 */
export function signupDecision(opts: {
  rule: SignupRule | null;
  approved: boolean;
  demo: boolean;
  alreadyHadSignupBonus: boolean;
  duplicateOf: string[];
  now: number;
}): { kind: "grant"; cents: number; expiresAt: number } | { kind: "flag" } | { kind: "none" } {
  const { rule, now } = opts;
  if (!opts.approved || opts.demo || opts.alreadyHadSignupBonus) return { kind: "none" };
  if (!rule?.enabled || rule.amountCents <= 0) return { kind: "none" };
  if (
    (rule.startsAt !== null && now < rule.startsAt) ||
    (rule.endsAt !== null && now > rule.endsAt)
  )
    return { kind: "none" };
  if (opts.duplicateOf.length) return { kind: "flag" };
  return { kind: "grant", cents: rule.amountCents, expiresAt: now + rule.expiryDays * DAY_MS };
}

/**
 * Accounting: a fee paid with credit counts as fee revenue at full value, and the credit used is a
 * promotion cost, so net fee revenue = fee revenue - promotion credits used.
 */
export function netFeeRevenue(feeRevenueCents: number, creditUsedCents: number) {
  return {
    feeRevenueCents,
    promotionCents: creditUsedCents,
    netCents: feeRevenueCents - creditUsedCents,
  };
}

/** Outstanding credit (granted, not used, not expired, not reversed): a liability. */
export function outstanding(grants: Grant[], now: number): number {
  return usableGrants(grants, now).reduce((n, g) => n + g.remainingCents, 0);
}
