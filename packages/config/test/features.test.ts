import { describe, expect, it } from "vitest";
import { featureOn, featuresOff } from "../src/features";

describe("feature flags", () => {
  it("are on outside production", () => {
    for (const site of ["development", "preview", "staging", undefined])
      expect(featureOn("providerMarketplace", { NEXT_PUBLIC_SITE_ENV: site })).toBe(true);
  });
  it("are off in production unless listed", () => {
    expect(featureOn("providerMarketplace", { NEXT_PUBLIC_SITE_ENV: "production" })).toBe(false);
    expect(
      featureOn("providerMarketplace", {
        NEXT_PUBLIC_SITE_ENV: "production",
        NEXT_PUBLIC_FEATURES: "other, providerMarketplace",
      }),
    ).toBe(true);
    expect(featuresOff({ NEXT_PUBLIC_SITE_ENV: "production" })).toEqual(["providerMarketplace"]);
  });
});
