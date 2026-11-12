import { describe, expect, it } from "vitest";
import { MarketSchema, MoneyCentsSchema, UsPhoneE164Schema } from "../src";

const validMarket = {
  id: "8d4e1c2a-3b5f-4a6d-9e7f-1a2b3c4d5e6f",
  slug: "test-metro",
  name: "Test Metro",
  stateCode: "TX",
  timeZone: "America/Chicago",
  currency: "USD",
  isActive: true,
};

describe("MarketSchema", () => {
  it("accepts a valid market", () => {
    expect(MarketSchema.parse(validMarket)).toEqual(validMarket);
  });

  it("rejects a bad slug, state code and time zone", () => {
    expect(MarketSchema.safeParse({ ...validMarket, slug: "Test Metro" }).success).toBe(false);
    expect(MarketSchema.safeParse({ ...validMarket, stateCode: "tx" }).success).toBe(false);
    expect(MarketSchema.safeParse({ ...validMarket, timeZone: "Mars/Olympus" }).success).toBe(
      false,
    );
  });
});

describe("primitives", () => {
  it("validates US E.164 phone numbers", () => {
    expect(UsPhoneE164Schema.safeParse("+13125550123").success).toBe(true);
    expect(UsPhoneE164Schema.safeParse("312-555-0123").success).toBe(false);
  });

  it("only allows whole, non-negative cents", () => {
    expect(MoneyCentsSchema.safeParse(1999).success).toBe(true);
    expect(MoneyCentsSchema.safeParse(19.99).success).toBe(false);
    expect(MoneyCentsSchema.safeParse(-1).success).toBe(false);
  });
});
