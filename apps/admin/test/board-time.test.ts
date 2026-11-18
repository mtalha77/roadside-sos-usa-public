import { describe, expect, it } from "vitest";
import { ageTone, formatAge, needsClosing } from "../src/lib/board-time";

const s = 1000;
const m = 60 * s;
const h = 60 * m;
const d = 24 * h;

describe("dispatch board timers (RSOS-103)", () => {
  it("formats seconds, minutes, hours, then stale days", () => {
    expect(formatAge(0)).toBe("0s");
    expect(formatAge(45 * s)).toBe("45s");
    expect(formatAge(59 * s + 999)).toBe("59s");
    expect(formatAge(m)).toBe("1m 00s");
    expect(formatAge(12 * m + 30 * s)).toBe("12m 30s");
    expect(formatAge(59 * m + 59 * s)).toBe("59m 59s");
    expect(formatAge(h)).toBe("1h 00m");
    expect(formatAge(2 * h + 14 * m + 50 * s)).toBe("2h 14m");
    expect(formatAge(23 * h + 59 * m)).toBe("23h 59m");
    expect(formatAge(2 * d + 3 * h)).toBe("Stale · 2d");
    expect(formatAge(d, { stale: "Antigua" })).toBe("Antigua · 1d");
  });

  it("never shows a negative age (clock drift)", () => {
    expect(formatAge(-5 * s)).toBe("0s");
  });

  it("turns amber at 3 minutes and red at 10 minutes without a quote", () => {
    expect(ageTone(true, 2 * m + 59 * s)).toBeNull();
    expect(ageTone(true, 3 * m)).toBe("warning");
    expect(ageTone(true, 9 * m + 59 * s)).toBe("warning");
    expect(ageTone(true, 10 * m)).toBe("critical");
    expect(ageTone(false, 30 * m)).toBeNull();
  });

  it("needs closing after 2 hours", () => {
    expect(needsClosing(2 * h - 1)).toBe(false);
    expect(needsClosing(2 * h)).toBe(true);
  });
});
