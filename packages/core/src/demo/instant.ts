import { type DemoPick, type DemoQuote, instantPick, TIMING } from "./engine";

export { instantPick };

/**
 * Instant book (RSOS-109). Instead of comparing quotes, the customer sets the most they will pay;
 * the first provider whose quote is at or below it is booked automatically. Pure functions, used
 * by the customer's status page, the demo scenario, the provider portal and the tests.
 */
export type BookingMode = "compare" | "instant";

/** How long quotes may arrive (seconds after the request was sent). */
export const QUOTE_WINDOW_SEC = TIMING.expireAt;

export type InstantOutcome =
  | { kind: "booked"; pick: DemoPick }
  /** Still inside the quote window, nothing at or below the ceiling yet. */
  | { kind: "waiting" }
  /** Window over: compare whatever quotes arrived. */
  | { kind: "compare" }
  /** Window over and no quote at all: our dispatchers find a provider (last fallback). */
  | { kind: "manual" };

/** Where an Instant book request stands at `nowSec`: booked, waiting, or which fallback applies. */
export function instantOutcome(
  quotes: readonly DemoQuote[],
  maxCents: number,
  nowSec: number,
  fromSec = 0,
  windowSec = QUOTE_WINDOW_SEC,
): InstantOutcome {
  const pick = instantPick(quotes, maxCents, fromSec, windowSec);
  if (pick && pick.atSec <= nowSec) return { kind: "booked", pick };
  if (nowSec < windowSec) return { kind: "waiting" };
  return quotes.some((q) => q.arrivesAtSec <= windowSec) ? { kind: "compare" } : { kind: "manual" };
}

/** The ceiling the form starts with: the market's typical price, the middle of its range. */
export const typicalPriceCents = (minCents: number, maxCents: number) =>
  Math.round((minCents + maxCents) / 2 / 500) * 500;
