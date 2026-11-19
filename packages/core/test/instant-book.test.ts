import { describe, expect, it } from "vitest";
import {
  type DemoQuote,
  demoState,
  demoStream,
  instantOutcome,
  instantPick,
  typicalPriceCents,
} from "../src/demo";

const q = (id: string, priceCents: number, arrivesAtSec: number, etaMinutes = 20): DemoQuote =>
  ({ id, priceCents, arrivesAtSec, etaMinutes, provider: {} }) as unknown as DemoQuote;
const quotes = [q("a", 12_000, 25), q("b", 8_000, 60), q("c", 7_000, 95)];

describe("Instant book (RSOS-109)", () => {
  it("books the first quote at or below the ceiling, when it arrives", () => {
    expect(instantPick(quotes, 9_000)).toEqual({ quoteId: "b", atSec: 60 });
    expect(instantOutcome(quotes, 9_000, 59)).toEqual({ kind: "waiting" });
    expect(instantOutcome(quotes, 9_000, 60)).toEqual({
      kind: "booked",
      pick: { quoteId: "b", atSec: 60 },
    });
  });

  it("respects the ceiling: a higher quote never books", () => {
    expect(instantPick(quotes, 6_000)).toBeNull();
    // Exactly at the ceiling is accepted.
    expect(instantPick(quotes, 7_000)).toEqual({ quoteId: "c", atSec: 95 });
  });

  it("switching to Instant book later books an earlier qualifying quote at the switch", () => {
    expect(instantPick(quotes, 13_000, 40)).toEqual({ quoteId: "a", atSec: 40 });
  });

  it("falls back to comparing quotes, then to manual dispatch", () => {
    // Window over, quotes in but all above the ceiling: compare what arrived.
    expect(instantOutcome(quotes, 6_000, 200)).toEqual({ kind: "compare" });
    // No quote at all in the window: our dispatchers take it.
    expect(instantOutcome([], 6_000, 200)).toEqual({ kind: "manual" });
    // A quote after the window never books.
    expect(instantPick([q("late", 5_000, 300)], 9_000)).toBeNull();
  });

  it("starts the ceiling at the market's typical price", () => {
    expect(typicalPriceCents(6_000, 12_000)).toBe(9_000);
    expect(typicalPriceCents(6_500, 9_900)).toBe(8_000);
  });

  it("the demo scenario books Instant book requests automatically", () => {
    const now = Date.UTC(2026, 10, 19, 12);
    const reqs = demoStream(now, { markets: ["san-antonio"] });
    const instant = reqs.filter((r) => r.instant);
    expect(instant.length).toBeGreaterThan(0);
    for (const r of instant) {
      const auto = instantPick(r.quotes, r.instant!.maxCents);
      const s = demoState(r, r.createdAt + 400_000);
      if (r.outcome === "completed" && auto) {
        expect(s.picked?.id).toBe(auto.quoteId);
        expect(s.picked!.priceCents).toBeLessThanOrEqual(r.instant!.maxCents);
      }
    }
  });
});
