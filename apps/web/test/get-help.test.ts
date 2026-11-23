import { describe, expect, it } from "vitest";
import {
  allowedStep,
  attributionFrom,
  currentStep,
  previousStep,
  STEPS,
  toE164,
} from "../src/lib/get-help";

describe("get help flow (RSOS-021, three screens since RSOS-101)", () => {
  const base = { market: "market-a", lat: 29.76, lng: -95.37 };
  const answers = { safety: "safe" };
  it("resumes at the first unfinished screen", () => {
    expect(currentStep({})).toBe("problem");
    // RSOS-116: screen 1 asks the service's questions before the location.
    expect(currentStep({ service: "flat-tire" })).toBe("problem");
    expect(currentStep({ service: "flat-tire", answers })).toBe("location");
    expect(currentStep({ ...base, service: "flat-tire", answers })).toBe("details");
    // An ad landing page asks the address first: screen 1 comes next.
    expect(currentStep({ ...base, service: "flat-tire" })).toBe("problem");
    // A tow also needs where to take the vehicle, asked on the location screen.
    expect(currentStep({ ...base, service: "tow", answers })).toBe("location");
    expect(currentStep({ ...base, service: "tow", answers, destAddress: "1 Main St" })).toBe(
      "details",
    );
  });
  it("has at most three screens, and screens cannot be skipped", () => {
    expect(STEPS).toHaveLength(3);
    expect(allowedStep({}, "details")).toBe("problem");
    expect(allowedStep({ ...base, service: "tow", answers, destAddress: "x" }, "location")).toBe(
      "location",
    );
    expect(previousStep({ service: "flat-tire" }, "details")).toBe("location");
    expect(previousStep({}, "problem")).toBeNull();
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
