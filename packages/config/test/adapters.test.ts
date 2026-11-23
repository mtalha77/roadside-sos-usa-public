import { describe, expect, it } from "vitest";
import { ADAPTER_KEYS, adapterState, adapterStates } from "../src/adapters";

describe("adapter states", () => {
  it("is real only when every key is present (and the flag is on, where there is one)", () => {
    const env = Object.fromEntries(ADAPTER_KEYS.softphone.map((k) => [k, "x"]));
    expect(adapterState("softphone", { ...env, NEXT_PUBLIC_SITE_ENV: "production" })).toBe("real");
    expect(
      adapterState("softphone", {
        [ADAPTER_KEYS.softphone[0]]: "x",
        NEXT_PUBLIC_SITE_ENV: "staging",
      }),
    ).toBe("fake");
    const maps = Object.fromEntries(ADAPTER_KEYS.maps.map((k) => [k, "x"]));
    expect(adapterState("maps", { ...maps, NEXT_PUBLIC_SITE_ENV: "production" })).toBe("deferred");
    expect(adapterState("maps", { ...maps, MAPS_ENABLED: "true" })).toBe("real");
  });

  it("uses fakes outside production and reports missing keys in production", () => {
    expect(adapterState("twilio", { NEXT_PUBLIC_SITE_ENV: "staging" })).toBe("fake");
    expect(adapterState("twilio", { NEXT_PUBLIC_SITE_ENV: "production" })).toBe("missing");
    const all = adapterStates({ NEXT_PUBLIC_SITE_ENV: "preview" });
    expect(Object.values(all).every((s) => s === "fake" || s === "deferred")).toBe(true);
  });

  it("reports owner-deferred services as deferred, never missing", () => {
    for (const name of ["maps", "texting", "email"] as const)
      expect(adapterState(name, { NEXT_PUBLIC_SITE_ENV: "production" })).toBe("deferred");
  });
});
