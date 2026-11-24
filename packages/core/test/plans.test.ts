import { describe, expect, it } from "vitest";
import {
  averageFee,
  breakEvenJobs,
  canAddTechnician,
  discountedFee,
  featuredQualifies,
  monthlyRecurringRevenue,
  offerDelaySeconds,
  priceChangeDate,
  proSavings,
  withFeaturedOnTop,
} from "../src/plans";

describe("plans: fees and break-even (RSOS-114)", () => {
  it("takes 15% off a fee on Pro", () => {
    expect(discountedFee(4250, 1500)).toBe(3613);
    expect(discountedFee(2250, 0)).toBe(2250);
  });

  it("matches the spec's break-even example: about 23 jobs with the defaults", () => {
    expect(breakEvenJobs(12_900, 2000, 3250, 1500)).toBe(23);
    expect(breakEvenJobs(12_900, 2000, 3250, 0)).toBeNull();
  });

  it("averages the provider's own fees and computes what Pro would have saved", () => {
    expect(averageFee([])).toBeNull();
    expect(averageFee([4250, 2250])).toBe(3250);
    const fees = Array.from({ length: 34 }, () => 3250);
    // 34 jobs x 4.875 USD saved = 165.75 USD, minus the 109 USD higher price.
    expect(proSavings(fees, 1500, 12_900, 2000)).toBe(34 * (3250 - 2763) - 10_900);
    expect(proSavings([3250], 1500, 12_900, 2000)).toBeLessThan(0);
  });

  it("limits technicians on Basic and not on Pro", () => {
    expect(canAddTechnician(2, 1)).toBe(true);
    expect(canAddTechnician(2, 2)).toBe(false);
    expect(canAddTechnician(null, 500)).toBe(true);
  });
});

describe("plans: offers and first look", () => {
  it("sends no offers without a plan", () => {
    expect(offerDelaySeconds({ plan: null, anyProInRange: true, firstLookSeconds: 15 })).toBeNull();
  });

  it("gives Pro the first look and makes others wait", () => {
    expect(offerDelaySeconds({ plan: "pro", anyProInRange: true, firstLookSeconds: 15 })).toBe(0);
    expect(offerDelaySeconds({ plan: "basic", anyProInRange: true, firstLookSeconds: 15 })).toBe(
      15,
    );
  });

  it("sends to everyone at once when no Pro is in range or for Instant book above the limit", () => {
    expect(offerDelaySeconds({ plan: "basic", anyProInRange: false, firstLookSeconds: 15 })).toBe(
      0,
    );
    expect(
      offerDelaySeconds({
        plan: "basic",
        anyProInRange: true,
        firstLookSeconds: 15,
        instantAboveLimit: true,
      }),
    ).toBe(0);
    expect(offerDelaySeconds({ plan: "basic", anyProInRange: true, firstLookSeconds: 90 })).toBe(
      30,
    );
  });
});

describe("plans: Featured placement", () => {
  const rules = { priceRulePct: 15, etaRuleMinutes: 10 };
  const q = (id: string, priceCents: number, etaMinutes: number, featured = false) => ({
    id,
    priceCents,
    etaMinutes,
    featured,
  });

  it("puts a Featured quote on top only within 15% of the cheapest and 10 minutes of the fastest", () => {
    const list = [q("a", 10_000, 20), q("b", 11_000, 25, true), q("c", 12_000, 15)];
    expect(featuredQualifies(list[1]!, list, rules)).toBe(true);
    expect(withFeaturedOnTop(list, rules)).toEqual({
      quotes: [list[1], list[0], list[2]],
      topId: "b",
    });
  });

  it("leaves a Featured quote in its normal place when it is too expensive or too slow", () => {
    const pricey = [q("a", 10_000, 20), q("b", 11_600, 20, true)];
    const slow = [q("a", 10_000, 10), q("b", 10_000, 21, true)];
    expect(withFeaturedOnTop(pricey, rules).topId).toBeNull();
    expect(withFeaturedOnTop(slow, rules).topId).toBeNull();
    expect(withFeaturedOnTop(slow, rules).quotes).toEqual(slow);
  });

  it("shows at most one Featured quote on top: lowest price first, then fastest", () => {
    const list = [
      q("a", 10_000, 20),
      q("b", 10_500, 25, true),
      q("c", 10_500, 22, true),
      q("d", 11_000, 15, true),
    ];
    const { quotes, topId } = withFeaturedOnTop(list, rules);
    expect(topId).toBe("c");
    expect(quotes.map((x) => x.id)).toEqual(["c", "a", "b", "d"]);
  });
});

describe("plans: price changes", () => {
  const now = new Date("2026-11-24T00:00:00Z");

  it("keeps grandfathered subscribers on their price", () => {
    expect(
      priceChangeDate({
        periodEnd: new Date("2026-12-10T00:00:00Z"),
        effectiveFrom: now,
        now,
        noticeDays: 30,
        grandfather: true,
      }),
    ).toBeNull();
  });

  it("moves others on their first billing date after the notice period", () => {
    expect(
      priceChangeDate({
        periodEnd: new Date("2026-12-10T00:00:00Z"),
        effectiveFrom: now,
        now,
        noticeDays: 30,
        grandfather: false,
      })?.toISOString(),
    ).toBe("2027-01-10T00:00:00.000Z");
    expect(
      priceChangeDate({
        periodEnd: new Date("2026-12-30T00:00:00Z"),
        effectiveFrom: new Date("2027-02-01T00:00:00Z"),
        now,
        noticeDays: 30,
        grandfather: false,
      })?.toISOString(),
    ).toBe("2027-02-28T00:00:00.000Z");
  });

  it("sums monthly recurring revenue from active subscriptions only", () => {
    expect(
      monthlyRecurringRevenue([
        { status: "active", priceCents: 2000 },
        { status: "active", priceCents: 12_900 },
        { status: "waitlist", priceCents: 3750 },
      ]),
    ).toBe(14_900);
  });
});
