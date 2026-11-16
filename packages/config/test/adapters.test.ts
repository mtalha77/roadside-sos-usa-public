import { describe, expect, it } from "vitest";
import { ADAPTER_KEYS, adapterState, adapterStates } from "../src/adapters";

describe("adapter states", () => {
  it("is real only when every key is present", () => {
    const env = Object.fromEntries(ADAPTER_KEYS.maps.map((k) => [k, "x"]));
    expect(adapterState("maps", { ...env, NEXT_PUBLIC_SITE_ENV: "production" })).toBe("real");
    expect(
      adapterState("maps", { [ADAPTER_KEYS.maps[0]]: "x", NEXT_PUBLIC_SITE_ENV: "staging" }),
    ).toBe("fake");
  });

  it("uses fakes outside production and reports missing keys in production", () => {
    expect(adapterState("twilio", { NEXT_PUBLIC_SITE_ENV: "staging" })).toBe("fake");
    expect(adapterState("twilio", { NEXT_PUBLIC_SITE_ENV: "production" })).toBe("missing");
    const all = adapterStates({ NEXT_PUBLIC_SITE_ENV: "preview" });
    expect(Object.values(all).every((s) => s === "fake")).toBe(true);
  });
});
