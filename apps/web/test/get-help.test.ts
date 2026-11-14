import { describe, expect, it } from "vitest";
import {
  allowedStep,
  attributionFrom,
  currentStep,
  previousStep,
  stepsFor,
  toE164,
} from "../src/lib/get-help";

describe("get help flow (RSOS-021)", () => {
  const base = { market: "houston", lat: 29.76, lng: -95.37 };
  it("resumes at the first unfinished step", () => {
    expect(currentStep({})).toBe("location");
    expect(currentStep(base)).toBe("problem");
    expect(currentStep({ ...base, service: "tow" })).toBe("destination");
    expect(currentStep({ ...base, service: "flat-tire" })).toBe("vehicle");
    expect(currentStep({ ...base, service: "flat-tire", vehicleType: "car", safe: true })).toBe(
      "contact",
    );
    expect(
      currentStep({
        ...base,
        service: "flat-tire",
        vehicleType: "car",
        safe: true,
        name: "A",
        phone: "+17135550100",
      }),
    ).toBe("verify");
  });
  it("only tow and winch out ask for a destination, and steps cannot be skipped", () => {
    expect(stepsFor({ service: "flat-tire" })).not.toContain("destination");
    expect(stepsFor({ service: "tow" })).toContain("destination");
    expect(allowedStep(base, "contact")).toBe("problem");
    expect(allowedStep({ ...base, service: "tow", destAddress: "x" }, "location")).toBe("location");
    expect(previousStep({ service: "flat-tire" }, "vehicle")).toBe("problem");
    expect(previousStep({}, "location")).toBeNull();
  });
  it("normalizes phone numbers and keeps ad parameters", () => {
    expect(toE164("(713) 555-0123")).toBe("+17135550123");
    expect(toE164("1 713 555 0123")).toBe("+17135550123");
    expect(toE164("123")).toBeNull();
    expect(attributionFrom(new URLSearchParams("utm_source=google&gclid=abc&x=1"))).toEqual({
      utm_source: "google",
      gclid: "abc",
    });
  });
});
