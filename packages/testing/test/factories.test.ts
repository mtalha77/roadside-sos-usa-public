import { MarketSchema, UsPhoneE164Schema } from "@rsos/core";
import { beforeEach, describe, expect, it } from "vitest";
import { buildMarket, buildProvider, buildRequest, resetFactories } from "../src";

beforeEach(() => resetFactories());

describe("factories", () => {
  it("builds valid markets that pass the real schema", () => {
    expect(MarketSchema.parse(buildMarket())).toBeTruthy();
    expect(buildMarket({ slug: "custom" }).slug).toBe("custom");
  });

  it("builds providers and requests with fake, valid US phone numbers", () => {
    expect(UsPhoneE164Schema.safeParse(buildProvider().phone).success).toBe(true);
    expect(UsPhoneE164Schema.safeParse(buildRequest().driverPhone).success).toBe(true);
  });

  it("is deterministic after reset", () => {
    const a = buildRequest();
    resetFactories();
    expect(buildRequest()).toEqual(a);
  });

  it("links a request to a given market", () => {
    const market = buildMarket();
    expect(buildRequest({ marketId: market.id }).marketId).toBe(market.id);
  });
});
