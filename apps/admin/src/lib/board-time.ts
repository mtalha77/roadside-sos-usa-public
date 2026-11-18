/**
 * Dispatch board timers (RSOS-103). Pure functions, shared by the board, the Today page and tests.
 *
 * - Ages read "45s", "12m 30s", "2h 14m", then "Stale · 2d" from one day on.
 * - A request still waiting for a quote turns amber at 3 minutes and red at 10 minutes.
 * - Anything older than 2 hours that has not finished needs closing.
 */
/** Board lanes; "closing": older than 2 hours without progress. */
export type Lane = "new" | "quoting" | "picked" | "en_route" | "on_site" | "closing";
export const LANES: Lane[] = ["new", "quoting", "picked", "en_route", "on_site", "closing"];

export const AMBER_MS = 3 * 60_000;
export const RED_MS = 10 * 60_000;
export const CLOSE_MS = 2 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Short labels, translated by the caller: `{ stale: "Stale" }`. */
export function formatAge(ms: number, labels: { stale: string } = { stale: "Stale" }): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  if (ms < DAY_MS) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  return `${labels.stale} · ${Math.floor(ms / DAY_MS)}d`;
}

export type AgeTone = "critical" | "warning" | null;

/** Waiting for a quote: amber from 3 minutes, red from 10. Other stages have no colour. */
export function ageTone(waitingForQuote: boolean, ms: number): AgeTone {
  if (!waitingForQuote) return null;
  if (ms >= RED_MS) return "critical";
  if (ms >= AMBER_MS) return "warning";
  return null;
}

/** Older than 2 hours without finishing: it belongs in "Needs closing". */
export const needsClosing = (ms: number) => ms >= CLOSE_MS;
