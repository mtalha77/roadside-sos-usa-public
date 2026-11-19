import { describe, expect, it } from "vitest";
import {
  balances,
  campaignPlan,
  canGrant,
  DAY_MS,
  duplicates,
  expiring,
  type Grant,
  netFeeRevenue,
  normalizeIdentifier,
  outstanding,
  refund,
  reminderDue,
  reversible,
  signupDecision,
  spend,
} from "../src/wallet";

// RSOS-115: wallet bonus credits. Seeded grants and fixed times.
const NOW = Date.UTC(2026, 10, 19, 12);
const g = (id: string, cents: number, days: number, o: Partial<Grant> = {}): Grant => ({
  id,
  amountCents: cents,
  remainingCents: cents,
  expiresAt: NOW + days * DAY_MS,
  planAllowed: false,
  reversed: false,
  ...o,
});

describe("spend order", () => {
  const grants = [
    g("late", 3000, 50),
    g("soon", 2000, 10),
    g("plan", 1000, 5, { planAllowed: true }),
  ];

  it("bonus credit first, oldest expiry first, then the paid balance", () => {
    expect(spend(4500, 10_000, grants, NOW)).toEqual({
      fromGrants: [
        { grantId: "plan", cents: 1000 },
        { grantId: "soon", cents: 2000 },
        { grantId: "late", cents: 1500 },
      ],
      bonusCents: 4500,
      paidCents: 0,
      shortCents: 0,
    });
    expect(spend(7500, 10_000, grants, NOW)).toMatchObject({ bonusCents: 6000, paidCents: 1500 });
  });

  it("expired, reversed and empty grants are skipped", () => {
    const list = [
      g("old", 1000, -1),
      g("rev", 1000, 30, { reversed: true }),
      g("empty", 1000, 30, { remainingCents: 0 }),
      g("ok", 500, 30),
    ];
    expect(spend(800, 0, list, NOW)).toEqual({
      fromGrants: [{ grantId: "ok", cents: 500 }],
      bonusCents: 500,
      paidCents: 0,
      shortCents: 300,
    });
  });

  it("plans use only grants that allow plans", () => {
    expect(spend(3000, 1000, grants, NOW, "plan")).toEqual({
      fromGrants: [{ grantId: "plan", cents: 1000 }],
      bonusCents: 1000,
      paidCents: 1000,
      shortCents: 1000,
    });
  });

  it("balances show both kinds and the next expiry", () => {
    expect(balances(0, grants, NOW)).toEqual({
      paidCents: 0,
      bonusCents: 6000,
      totalCents: 6000,
      nextExpiry: { at: NOW + 5 * DAY_MS, cents: 1000 },
    });
    expect(outstanding(grants, NOW + 20 * DAY_MS)).toBe(3000);
  });
});

describe("expiry job", () => {
  it("expires what is left on grants past their date", () => {
    const list = [
      g("a", 1000, 0),
      g("b", 2000, 1, { remainingCents: 700 }),
      g("c", 500, -3, { remainingCents: 0 }),
    ];
    expect(expiring(list, NOW + DAY_MS)).toEqual([
      { grantId: "a", cents: 1000 },
      { grantId: "b", cents: 700 },
    ]);
  });

  it("reminds 7 days and 1 day before", () => {
    const list = [g("week", 1000, 7), g("day", 1000, 1), g("later", 1000, 20)];
    expect(reminderDue(list, NOW)).toEqual([
      { grantId: "day", days: 1 },
      { grantId: "week", days: 7 },
    ]);
  });
});

describe("refunds and reversals", () => {
  it("a refunded fee returns credit with its expiry or 14 days, whichever is later", () => {
    expect(
      refund(
        500,
        [
          { grantId: "soon", cents: 1000, expiresAt: NOW + 3 * DAY_MS },
          { grantId: "late", cents: 800, expiresAt: NOW + 40 * DAY_MS },
        ],
        NOW,
      ),
    ).toEqual({
      paidCents: 500,
      credits: [
        { cents: 1000, expiresAt: NOW + 14 * DAY_MS, fromGrant: "soon" },
        { cents: 800, expiresAt: NOW + 40 * DAY_MS, fromGrant: "late" },
      ],
    });
  });

  it("only unused credit can be reversed", () => {
    expect(reversible(g("x", 5000, 30, { remainingCents: 1200 }), NOW)).toBe(1200);
    expect(reversible(g("x", 5000, 30, { reversed: true }), NOW)).toBe(0);
    expect(reversible(g("x", 5000, -1), NOW)).toBe(0);
  });
});

describe("approval limits", () => {
  it("an operations manager grants up to 100 USD, campaigns up to 1,000 USD; above needs the owner", () => {
    expect(canGrant("ops_manager", "grant", 10_000)).toBe("ok");
    expect(canGrant("ops_manager", "grant", 10_001)).toBe("needs_owner");
    expect(canGrant("ops_manager", "campaign", 100_000)).toBe("ok");
    expect(canGrant("ops_manager", "campaign", 150_000)).toBe("needs_owner");
    expect(canGrant("super_admin", "campaign", 10_000_000)).toBe("ok");
    expect(canGrant("finance", "grant", 100)).toBe("forbidden");
    expect(canGrant("dispatcher", "grant", 100)).toBe("forbidden");
  });

  it("limits are editable", () => {
    const limits = { ops_manager: { perGrantCents: 2500, perCampaignCents: null } };
    expect(canGrant("ops_manager", "grant", 3000, limits)).toBe("needs_owner");
    expect(canGrant("ops_manager", "campaign", 9_999_999, limits)).toBe("ok");
  });
});

describe("campaign budget cap", () => {
  const people = ["p1", "p2", "p3", "p4", "p5"].map((id) => ({ id }));
  it("stops at the cap, never a partial grant", () => {
    expect(campaignPlan(people, 2500, 10_000)).toEqual({
      granted: people.slice(0, 4),
      leftOut: people.slice(4),
      totalCents: 10_000,
    });
    expect(campaignPlan(people, 3000, 10_000).totalCents).toBe(9000);
    expect(campaignPlan(people, 2500, 10_000, 8000).granted).toHaveLength(0);
    expect(campaignPlan(people, 2500, 1_000_000).leftOut).toHaveLength(0);
  });
});

describe("duplicate business detection", () => {
  it("matches normalized identifiers across businesses", () => {
    expect(normalizeIdentifier("ein", "12-3456789")).toBe("123456789");
    expect(normalizeIdentifier("phone", "+1 (210) 555-0142")).toBe("2105550142");
    expect(normalizeIdentifier("insurance_policy", " AB-12 34 ")).toBe("ab1234");
    expect(
      duplicates(
        [
          { kind: "ein", value: "12-3456789" },
          { kind: "phone", value: "(210) 555-0142" },
        ],
        [
          { providerId: "other", kind: "ein", value: "123456789" },
          { providerId: "other", kind: "ein", value: "12 3456789" },
          { providerId: "third", kind: "phone", value: "+12105550142" },
          { providerId: "fine", kind: "phone", value: "2105550199" },
          { providerId: "fine", kind: "insurance_policy", value: "123456789" },
        ],
      ),
    ).toEqual([
      { providerId: "other", kind: "ein" },
      { providerId: "third", kind: "phone" },
    ]);
  });
});

describe("signup bonus", () => {
  const rule = { enabled: true, amountCents: 5000, expiryDays: 60, startsAt: null, endsAt: null };
  const base = {
    rule,
    approved: true,
    demo: false,
    alreadyHadSignupBonus: false,
    duplicateOf: [],
    now: NOW,
  };

  it("is granted only on approval", () => {
    expect(signupDecision({ ...base, approved: false })).toEqual({ kind: "none" });
    expect(signupDecision(base)).toEqual({
      kind: "grant",
      cents: 5000,
      expiresAt: NOW + 60 * DAY_MS,
    });
  });

  it("once per business; a duplicate is flagged for review, not refused silently", () => {
    expect(signupDecision({ ...base, alreadyHadSignupBonus: true })).toEqual({ kind: "none" });
    expect(signupDecision({ ...base, duplicateOf: ["other"] })).toEqual({ kind: "flag" });
  });

  it("respects the rule's switch and dates; demo providers never get one", () => {
    expect(signupDecision({ ...base, rule: { ...rule, enabled: false } })).toEqual({
      kind: "none",
    });
    expect(signupDecision({ ...base, rule: { ...rule, startsAt: NOW + DAY_MS } })).toEqual({
      kind: "none",
    });
    expect(signupDecision({ ...base, rule: { ...rule, endsAt: NOW - DAY_MS } })).toEqual({
      kind: "none",
    });
    expect(signupDecision({ ...base, rule: null })).toEqual({ kind: "none" });
    expect(signupDecision({ ...base, demo: true })).toEqual({ kind: "none" });
  });
});

describe("accounting", () => {
  it("fee revenue at full value, minus promotion credits used, is net fee revenue", () => {
    expect(netFeeRevenue(325_000, 40_000)).toEqual({
      feeRevenueCents: 325_000,
      promotionCents: 40_000,
      netCents: 285_000,
    });
  });
});

describe("economics: signup bonus", () => {
  it("promotion credits lower contribution, fee revenue stays at full value", async () => {
    const { computeEconomics } = await import("../src/economics");
    const base = {
      monthlyBudget: 1000,
      costPerClick: 10,
      clickToRequest: 0.5,
      acceptance: 0.5,
      serviceMix: { tow: 1 },
      feeByService: { tow: 40 },
      paymentFeeShare: 0,
      subscriptionsNet: 0,
      fixedCosts: 0,
    };
    const without = computeEconomics(base);
    const withBonus = computeEconomics({ ...base, signupBonus: 50, newProvidersPerMonth: 4 });
    expect(withBonus.feeRevenue).toBe(without.feeRevenue);
    expect(withBonus.promotionCredits).toBe(200);
    expect(withBonus.netFeeRevenue).toBe(without.feeRevenue - 200);
    expect(withBonus.contribution).toBe(without.contribution - 200);
  });
});
