import { describe, expect, it } from "vitest";
import { deviceLabel, when } from "../src/components/when";

describe("account display helpers", () => {
  it("labels devices from the user agent", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Safari/605.1")).toBe(
      "Safari · iOS",
    );
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36")).toBe(
      "Chrome · Windows",
    );
    expect(deviceLabel("curl/8")).toBeNull();
    expect(deviceLabel(null)).toBeNull();
  });
  it("shows times in UTC with the zone", () => {
    expect(when("2026-11-13T15:04:00Z", "en")).toContain("UTC");
    expect(when(null, "en")).toBe("");
  });
});
