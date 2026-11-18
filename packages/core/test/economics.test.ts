import { describe, expect, it } from "vitest";
import {
  buildFunnel,
  computeEconomics,
  type EconomicsInputs,
  sumEconomics,
  weightedFee,
} from "../src/economics";

// The owner's brief (RSOS-113, Roadside Lead Platform: Structure & Risk Brief, Nov 2026). The three
// launch markets are called A, B and C here: market names are data, never code or tests.
const mix = { tow: 0.48, "jump-start": 0.26, "flat-tire": 0.12, lockout: 0.08, fuel: 0.06 };
const fees = { tow: 42.5, lockout: 27.5, "jump-start": 22.5, "flat-tire": 22.5, fuel: 22.5 };
const shared = {
  monthlyBudget: 4000,
  serviceMix: mix,
  feeByService: fees,
  paymentFeeShare: 0.08,
  subscriptionsNet: 900,
  fixedCosts: 3500,
};
const base = { ...shared, clickToRequest: 0.25, acceptance: 0.7 };
const strong = { ...shared, clickToRequest: 0.3, acceptance: 0.8 };
const inputs: Record<string, EconomicsInputs> = {
  "A base": { ...base, costPerClick: 4.25 },
  "A strong": { ...strong, costPerClick: 2.42 },
  "B base": { ...base, costPerClick: 4.87 },
  "B strong": { ...strong, costPerClick: 1.99 },
  "C base": { ...base, costPerClick: 5.95 },
  "C strong": { ...strong, costPerClick: 2.7 },
};

// The brief's Expected results table, as written (rounded).
const expected = [
  ["A base", 941, 235, 165, 5353, 1825, -1675, 24.29],
  ["A strong", 1653, 496, 397, 12893, 8761, 5261, 10.08],
  ["B base", 821, 205, 144, 4671, 1198, -2302, 27.83],
  ["B strong", 2010, 603, 482, 15678, 11324, 7824, 8.29],
  ["C base", 672, 168, 118, 3824, 418, -3082, 34.0],
  ["C strong", 1481, 444, 356, 11556, 7531, 4031, 11.25],
] as const;

describe("economics model (RSOS-113)", () => {
  it("weights the fee by the service mix: 32.50 USD", () => {
    expect(weightedFee(base)).toBeCloseTo(32.5, 10);
  });

  it.each(expected)(
    "%s reproduces the Expected results table",
    (key, clicks, requests, accepted, fee, contribution, profit, perAccepted) => {
      const r = computeEconomics(inputs[key]!);
      expect(Math.round(r.clicks)).toBe(clicks);
      expect(Math.round(r.requests)).toBe(requests);
      expect(Math.round(r.accepted)).toBe(accepted);
      expect(Math.round(r.feeRevenue)).toBe(fee);
      expect(Math.round(r.contribution)).toBe(contribution);
      expect(Math.round(r.profit)).toBe(profit);
      expect(Number(r.adCostPerAccepted!.toFixed(2))).toBe(perAccepted);
    },
  );

  it("payment fees are 8% of fee revenue and contribution adds subscriptions", () => {
    const r = computeEconomics(inputs["A base"]!);
    expect(r.paymentFees).toBeCloseTo(r.feeRevenue * 0.08, 10);
    expect(r.contribution).toBeCloseTo(r.feeRevenue + 900 - 4000 - r.paymentFees, 10);
  });

  it("break-even accepted requests make profit zero", () => {
    for (const k of Object.keys(inputs)) {
      const i = inputs[k]!;
      const r = computeEconomics(i);
      const be = r.breakEvenAccepted;
      if (be === null) continue;
      // At break-even volume, with the same cost per accepted request, profit is zero.
      const net = r.weightedFee * (1 - i.paymentFeeShare) - r.adCostPerAccepted!;
      expect(be * net + i.subscriptionsNet - i.fixedCosts).toBeCloseTo(0, 6);
    }
  });

  it("fixed costs shared across markets: one 3,500 USD spread over the live markets", () => {
    const each = 3500 / 3;
    const rows = ["A base", "B base", "C base"].map((k) => computeEconomics(inputs[k]!, each));
    const total = sumEconomics(rows);
    expect(total.fixedCosts).toBeCloseTo(3500, 10);
    const contributions = rows.reduce((n, r) => n + r.contribution, 0);
    expect(total.profit).toBeCloseTo(contributions - 3500, 6);
    expect(total.adCostPerAccepted).toBeCloseTo(12000 / total.accepted, 10);
  });
});

describe("funnel math (RSOS-113)", () => {
  it("never lets a later step pass an earlier one, and flags the data", () => {
    // The owner's screenshot: Completed 2,756 above Picked 2,309.
    const f = buildFunnel({
      visits: 40_000,
      started: 9000,
      submitted: 5000,
      quoted: 4000,
      picked: 2309,
      completed: 2756,
    });
    for (let i = 1; i < f.rows.length; i++) {
      expect(f.rows[i]!.count).toBeLessThanOrEqual(f.rows[i - 1]!.count);
      expect(f.rows[i]!.fromPrevious ?? 0).toBeLessThanOrEqual(1);
    }
    expect(f.broken).toEqual(["completed"]);
    expect(f.rows.at(-1)!.count).toBe(2309);
  });

  it("gives step-to-step and overall conversion", () => {
    const f = buildFunnel({
      visits: 1000,
      started: 400,
      submitted: 200,
      quoted: 180,
      picked: 140,
      completed: 120,
    });
    expect(f.broken).toEqual([]);
    expect(f.rows[0]!.fromPrevious).toBeNull();
    expect(f.rows[2]!.fromPrevious).toBeCloseTo(0.5, 10);
    expect(f.rows[5]!.fromFirst).toBeCloseTo(0.12, 10);
  });

  it("handles empty data without dividing by zero", () => {
    const f = buildFunnel({
      visits: 0,
      started: 0,
      submitted: 0,
      quoted: 0,
      picked: 0,
      completed: 0,
    });
    expect(f.rows.every((r) => r.fromPrevious === null)).toBe(true);
  });
});

describe("sources and channels (RSOS-113)", async () => {
  const { sourceOf, channelOf } = await import("../src/analytics-sources");
  it("tells sources apart, and phone is a channel, not a source", () => {
    expect(sourceOf({ gclid: "x" })).toBe("google_ads");
    expect(sourceOf({ fbclid: "x" })).toBe("meta");
    expect(sourceOf({ msclkid: "x" })).toBe("microsoft_ads");
    expect(sourceOf({ utmSource: "facebook" })).toBe("meta");
    expect(sourceOf({ referrer: "https://www.google.com/" })).toBe("organic");
    expect(sourceOf({ referrer: "https://news.example.org/a" })).toBe("referral");
    expect(sourceOf({})).toBe("direct");
    expect(sourceOf({ phonePurpose: "google_ads" })).toBe("google_ads");
    expect(sourceOf({ phonePurpose: "website" })).toBe("direct");
    expect(channelOf("phone")).toBe("phone");
    expect(channelOf("landing_page")).toBe("website");
  });
});

describe("demo volume follows the model (RSOS-113 B)", async () => {
  const { rngFor, scaleEconomics } = await import("../src/economics");
  it("30 days of seeded daily variation stay within 5% of the model", () => {
    const month = computeEconomics(inputs["A base"]!);
    for (const market of ["a", "b", "c"]) {
      let factor = 0;
      for (let d = 0; d < 30; d++) factor += 0.96 + rngFor(`${market}:${20400 - d}`) * 0.08;
      const demo = scaleEconomics(month, factor);
      expect(Math.abs(demo.requests / month.requests - 1)).toBeLessThan(0.05);
      expect(Math.abs(demo.feeRevenue / month.feeRevenue - 1)).toBeLessThan(0.05);
    }
  });
  it("a week is proportional to the month", () => {
    const month = computeEconomics(inputs["A base"]!);
    expect(scaleEconomics(month, 7).accepted).toBeCloseTo((month.accepted * 7) / 30, 10);
    // Rates and the cost per accepted request do not scale.
    expect(scaleEconomics(month, 7).adCostPerAccepted).toBe(month.adCostPerAccepted);
  });
});
