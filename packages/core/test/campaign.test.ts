import { describe, expect, it } from "vitest";
import { campaignCsv, campaignMetrics, type CampaignRequest } from "../src/campaign";

const t0 = Date.UTC(2026, 10, 1, 12);
const min = 60_000;
const req = (o: Partial<CampaignRequest>): CampaignRequest => ({
  marketId: "m1",
  status: "submitted",
  createdAt: t0,
  contactedAt: null,
  assignedAt: null,
  completedAt: null,
  quotedPriceCents: null,
  feeCents: null,
  ...o,
});

// Seeded test data: four requests and three calls in one market, nothing in another.
const requests = [
  req({
    contactedAt: t0 + 2 * min,
    assignedAt: t0 + 10 * min,
    completedAt: t0 + 60 * min,
    status: "completed",
    quotedPriceCents: 10000,
    feeCents: 1500,
  }),
  req({
    contactedAt: t0 + 4 * min,
    assignedAt: t0 + 20 * min,
    status: "assigned",
    quotedPriceCents: 12000,
    feeCents: 1500,
  }),
  req({ contactedAt: t0 + 6 * min, status: "no_provider" }),
  req({ status: "cancelled" }),
];
const calls = [
  { marketId: "m1", direction: "inbound", outcome: "answered" },
  { marketId: "m1", direction: "inbound", outcome: "missed" },
  { marketId: "m1", direction: "inbound", outcome: "completed" },
  { marketId: "m1", direction: "outbound", outcome: "completed" },
];
const spend = [
  { marketId: "m1", amountCents: 20000 },
  { marketId: "m1", amountCents: 20000 },
];

describe("campaign metrics", () => {
  const [m1, m2] = campaignMetrics(["m1", "m2"], requests, calls, spend);

  it("computes rates, medians and money for a market", () => {
    expect(m1).toEqual({
      marketId: "m1",
      requests: 4,
      calls: 3,
      answerRate: 2 / 3,
      minutesToContact: 4,
      minutesToAssigned: 15,
      fillRate: 0.5,
      completionRate: 0.25,
      avgQuotedPriceCents: 11000,
      feesCents: 3000,
      spendCents: 40000,
      costPerRequestCents: 10000,
      costPerCompletedCents: 40000,
    });
  });

  it("gives empty markets nulls, not zero divisions", () => {
    expect(m2).toMatchObject({
      requests: 0,
      calls: 0,
      answerRate: null,
      minutesToContact: null,
      fillRate: null,
      completionRate: null,
      avgQuotedPriceCents: null,
      costPerRequestCents: null,
      costPerCompletedCents: null,
    });
  });

  it("exports a CSV row per market", () => {
    const csv = campaignCsv([{ ...m1!, market: "Test, Market" }]);
    const [head, row] = csv.trim().split("\n");
    expect(head!.split(",")).toHaveLength(13);
    expect(row).toBe('"Test, Market",4,3,66.7,4,15,50.0,25.0,110.00,30.00,400.00,100.00,400.00');
  });
});
