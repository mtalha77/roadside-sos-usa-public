import { demoMarkets, legacyDemoProviderNames } from "@rsos/config/demo-fixtures";
import { describe, expect, it } from "vitest";
import {
  DRIVER_DEMO_TIMING,
  DRIVER_STAGES,
  REVIEW_SAMPLE_COUNT,
  demoProviderProfile,
  demoProviders,
  demoState,
  driverStageStarts,
  makeDemoRequest,
} from "../src/demo";

const t0 = Date.UTC(2026, 10, 16, 15, 0, 0);
const opts = { timing: DRIVER_DEMO_TIMING, driverControlled: true } as const;
const at = (createdAt: number, sec: number) => createdAt + sec * 1000;

describe("driver-controlled demo", () => {
  // Any seed: the driver's demo always completes, whatever the stream's outcome would be.
  const req = makeDemoRequest("san-antonio", 7, t0)!;

  it("waits on the quotes until the driver picks (no auto-pick, no cancel or expiry)", () => {
    const late = demoState(req, at(req.createdAt, 3600), null, opts);
    expect(late.stage).toBe("quoting");
    expect(late.picked).toBeNull();
    expect(demoState(req, req.createdAt, null, opts).stage).toBe("searching");
  });

  it("is about 20 s on the way, with the truck moving and the ETA counting down", () => {
    const q = req.quotes[0]!;
    const pick = { quoteId: q.id, atSec: q.arrivesAtSec + 5 };
    const s = driverStageStarts(req, pick);
    expect(s.en_route! < s.on_site!).toBe(true);
    expect(s.on_site! - s.en_route!).toBe(20);
    expect(s.completed! - s.on_site!).toBe(20);

    const start = demoState(req, at(req.createdAt, s.en_route! + 1), pick, opts);
    const mid = demoState(req, at(req.createdAt, s.en_route! + 10), pick, opts);
    expect(start.stage).toBe("en_route");
    expect(mid.stage).toBe("en_route");
    expect(mid.progress).toBeGreaterThan(start.progress);
    expect(mid.etaMinutes!).toBeLessThan(start.etaMinutes!);
    expect(mid.truck).not.toEqual(start.truck);

    expect(demoState(req, at(req.createdAt, s.on_site!), pick, opts).stage).toBe("on_site");
    expect(demoState(req, at(req.createdAt, s.completed!), pick, opts).stage).toBe("completed");
  });

  it("each stage start lands on that stage (Back, Next and the stepper jump there)", () => {
    const q = req.quotes[0]!;
    const pick = { quoteId: q.id, atSec: q.arrivesAtSec + 3 };
    const starts = driverStageStarts(req, pick);
    for (const stage of DRIVER_STAGES) {
      const sec = starts[stage]!;
      expect(
        demoState(req, at(req.createdAt, sec), stage === "searching" ? null : pick, opts).stage,
      ).toBe(stage);
    }
    const none = driverStageStarts(req, null);
    expect(none.picked).toBeNull();
    expect(none.quoting).toBe(q.arrivesAtSec);
  });

  it("a full demo, request to review, fits well under 3 minutes at 1x", () => {
    const q = req.quotes[0]!;
    const s = driverStageStarts(req, { quoteId: q.id, atSec: q.arrivesAtSec });
    expect(s.completed!).toBeLessThan(180);
  });
});

describe("demo providers", () => {
  const all = Object.keys(demoMarkets).flatMap((m) => demoProviders(m));

  it("have unique fictional names and unique logos", () => {
    expect(new Set(all.map((p) => p.name)).size).toBe(all.length);
    expect(new Set(all.map((p) => p.slug)).size).toBe(all.length);
    for (const p of all) {
      expect(p.name).toMatch(/\(demo\)$/);
      expect(legacyDemoProviderNames).not.toContain(p.name);
    }
    // Within a market, no two providers share a monogram, shape and colour.
    for (const m of Object.keys(demoMarkets)) {
      const marks = demoProviders(m).map(
        (p) => `${p.logo.monogram}-${p.logo.shape}-${p.logo.tone}`,
      );
      expect(new Set(marks).size).toBe(marks.length);
      const monograms = demoProviders(m).map((p) => p.logo.monogram);
      expect(new Set(monograms).size).toBe(monograms.length);
    }
    for (const p of all) {
      expect(p.logo.tone).toBeGreaterThanOrEqual(1);
      expect(p.logo.tone).toBeLessThanOrEqual(8);
    }
  });

  it("never use names of known real towing companies", () => {
    const banned = /trinity|kwik|ewing|snap|aaa|allstate|geico|honk|urgently|agero/i;
    for (const p of all) expect(p.name).not.toMatch(banned);
  });

  it("have a deterministic, consistent profile", () => {
    for (const p of all) {
      const a = demoProviderProfile(p);
      expect(demoProviderProfile(p)).toEqual(a);
      expect(a.breakdown.reduce((n, x) => n + x, 0)).toBe(p.reviews);
      expect(a.reviews.length).toBeLessThanOrEqual(4);
      for (const r of a.reviews) {
        expect(r.text).toBeLessThan(REVIEW_SAMPLE_COUNT);
        expect(r.stars).toBeGreaterThanOrEqual(1);
        expect(r.stars).toBeLessThanOrEqual(5);
      }
      expect(a.services.length).toBeGreaterThan(0);
      for (const s of a.services) expect(s.fromCents).toBeGreaterThan(0);
      expect(a.etaAccuracy).toBeGreaterThan(0);
      expect(a.etaAccuracy).toBeLessThanOrEqual(1);
      expect(a.photos.length).toBe(3);
      expect(p.payments.length).toBeGreaterThan(0);
      expect(p.years).toBeGreaterThan(0);
    }
  });
});
