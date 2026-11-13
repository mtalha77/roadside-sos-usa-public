import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDateTime,
  formatPriceRange,
  formatRelative,
  formatTime,
  resolveLocale,
} from "../src";

const noon = Date.UTC(2026, 6, 1, 19, 0); // 19:00 UTC on 1 July 2026

describe("formatting by locale and market time zone", () => {
  it("formats money per locale", () => {
    expect(formatCurrency(12850, "en")).toBe("$128.50");
    expect(formatCurrency(9500, "en")).toBe("$95");
    expect(formatCurrency(12850, "es")).toMatch(/128[.,]50/);
    expect(formatPriceRange(5000, 15000, "en")).toBe("$50 – $150");
  });

  it("shows the time in the market's zone, not the server's", () => {
    expect(formatTime(noon, "en", "America/Chicago")).toMatch(/^2:00\sPM CDT$/);
    // Phoenix does not observe daylight saving time.
    expect(formatTime(noon, "en", "America/Phoenix")).toMatch(/^12:00\sPM MST$/);
    expect(formatTime(noon, "en", "America/Los_Angeles")).toMatch(/^12:00\sPM PDT$/);
    expect(formatDateTime(noon, "es", "America/New_York", { dateStyle: "long" })).toContain(
      "julio",
    );
  });

  it("formats relative time per locale", () => {
    expect(formatRelative(noon + 12 * 60_000, noon, "en")).toBe("in 12 minutes");
    expect(formatRelative(noon - 3 * 60_000, noon, "es")).toBe("hace 3 minutos");
  });

  it("resolves the locale cookie safely", () => {
    expect(resolveLocale("es")).toBe("es");
    expect(resolveLocale("fr")).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});
