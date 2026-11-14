import { isDemoMode } from "@rsos/config/demo";
import { describe, expect, it } from "vitest";
import {
  DEMO_LIFETIME_SEC,
  demoRequestFromToken,
  demoState,
  demoStream,
  makeDemoRequest,
  seedFrom,
  TIMING,
} from "../src/demo";

describe("demo mode flag", () => {
  it("is on only when asked for, and never in production", () => {
    expect(isDemoMode({ NEXT_PUBLIC_SITE_ENV: "staging", NEXT_PUBLIC_DEMO_MODE: "true" })).toBe(
      true,
    );
    expect(isDemoMode({ NEXT_PUBLIC_SITE_ENV: "preview", NEXT_PUBLIC_DEMO_MODE: "false" })).toBe(
      false,
    );
    expect(isDemoMode({ NEXT_PUBLIC_SITE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "true" })).toBe(
      false,
    );
    expect(isDemoMode({})).toBe(false);
  });
});

describe("demo scenario engine", () => {
  const t0 = Date.UTC(2026, 10, 13, 15, 0, 0);

  it("is deterministic: same seed, same request", () => {
    expect(makeDemoRequest("houston", 42, t0)).toEqual(makeDemoRequest("houston", 42, t0));
    expect(makeDemoRequest("nowhere", 42, t0)).toBeNull();
  });

  it("prices stay within the market range and companies are marked as demo", () => {
    for (let s = 1; s < 200; s++) {
      const r = makeDemoRequest("san-antonio", s, t0, {
        tow: { min: 8000, max: 9000 },
        "flat-tire": { min: 5000, max: 6000 },
        "wont-start": { min: 5000, max: 6000 },
        "locked-out": { min: 5000, max: 6000 },
        "out-of-gas": { min: 5000, max: 6000 },
      })!;
      for (const q of r.quotes) {
        expect(q.priceCents).toBeGreaterThanOrEqual(r.serviceSlug === "tow" ? 8000 : 5000);
        expect(q.priceCents).toBeLessThanOrEqual(r.serviceSlug === "tow" ? 9000 : 6000);
        expect(q.provider.name).toMatch(/\(demo\)$/);
      }
      expect(r.driver.phone).toMatch(/^\+1\d{3}55501\d{2}$/);
    }
  });

  it("moves through every stage over time", () => {
    let seed = 1;
    let req = makeDemoRequest("las-vegas", seed, t0)!;
    while (req.outcome !== "completed") req = makeDemoRequest("las-vegas", ++seed, t0)!;
    const at = (sec: number) => demoState(req, t0 + sec * 1000);
    expect(at(1).stage).toBe("searching");
    expect(at(TIMING.pickAt - 1).stage).toBe("quoting");
    expect(at(TIMING.pickAt - 1).quotes.length).toBeGreaterThan(0);
    expect(at(TIMING.pickAt + 1).stage).toBe("picked");
    const mid = at(TIMING.pickAt + 10 + TIMING.travelSec / 2);
    expect(mid.stage).toBe("en_route");
    expect(mid.progress).toBeCloseTo(0.5, 1);
    expect(at(TIMING.pickAt + 10 + TIMING.travelSec + 5).stage).toBe("on_site");
    expect(at(DEMO_LIFETIME_SEC).stage).toBe("completed");
    expect(at(DEMO_LIFETIME_SEC).timeline.map((x) => x.stage)).toEqual([
      "searching",
      "quoting",
      "picked",
      "en_route",
      "on_site",
      "completed",
    ]);
  });

  it("the live stream is shared across apps and finds requests by token", () => {
    const now = t0 + 123_456;
    const a = demoStream(now, { markets: ["houston", "san-antonio"] });
    expect(a).toEqual(demoStream(now, { markets: ["houston", "san-antonio"] }));
    expect(a.length).toBeGreaterThan(20);
    expect(a.every((r) => r.createdAt <= now)).toBe(true);
    expect(demoRequestFromToken(a[0]!.token, now)?.id).toBe(a[0]!.id);
    expect(demoRequestFromToken("not-a-token", now)).toBeNull();
    expect(demoStream(now, { markets: ["houston"], intervalSec: 5 }).length).toBeGreaterThan(200);
  });

  it("follows the driver's own pick", () => {
    let seed = 1;
    let req = makeDemoRequest("houston", seed, t0)!;
    while (req.outcome !== "completed" || req.quotes.length < 2)
      req = makeDemoRequest("houston", ++seed, t0)!;
    const slowest = [...req.quotes].sort((a, b) => b.etaMinutes - a.etaMinutes)[0]!;
    const s = demoState(req, t0 + 100_000, { quoteId: slowest.id, atSec: 60 });
    expect(s.stage).toBe("en_route");
    expect(s.picked?.id).toBe(slowest.id);
    expect(seedFrom("abc")).toBe(seedFrom("abc"));
    expect(seedFrom("abc")).not.toBe(seedFrom("abd"));
  });
});
