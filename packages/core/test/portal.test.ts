import { describe, expect, it } from "vitest";
import { demoPortal, demoState, milesBetween } from "../src/demo";

describe("provider portal demo data", () => {
  const now = Date.UTC(2026, 10, 14, 18, 0, 0);
  const p = demoPortal(now, { marketSlug: "san-antonio" });

  it("is stable and uses the shared stream", () => {
    expect(demoPortal(now, { marketSlug: "san-antonio" }).history).toEqual(p.history);
    for (const o of p.offers)
      expect(["searching", "quoting"]).toContain(demoState(o.request, now).stage);
  });

  it("has a 60-day history, a wallet ledger and weekly insights", () => {
    expect(p.history.length).toBeGreaterThan(60);
    expect(p.txns.some((t) => t.kind === "fee" && t.amountCents < 0)).toBe(true);
    expect(p.txns.some((t) => t.kind === "top_up" && t.amountCents > 0)).toBe(true);
    expect(p.weeks).toHaveLength(8);
    expect(p.team[0]?.role).toBe("owner");
    expect(p.provider.name).toMatch(/\(demo\)$/);
  });

  it("measures distance in miles", () => {
    expect(
      milesBetween({ lat: 29.4241, lng: -98.4936 }, { lat: 29.7604, lng: -95.3698 }),
    ).toBeGreaterThan(180);
  });
});
