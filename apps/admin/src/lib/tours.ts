import type { TourStep } from "@rsos/ui/tour";

/**
 * Admin tours (RSOS-105). Role tours run on first sign-in and spotlight the menu; page tours run
 * from the "?" button on a page. Texts live in messages (tours.admin.*); targets are data-tour.
 */
export const ROLE_TOURS = {
  owner: ["nav-today", "nav-team", "nav-markets", "nav-finance", "search", "take-tour"],
  dispatcher: ["nav-inbox", "nav-inbox", "nav-dispatch", "nav-dispatch", "nav-calls", "take-tour"],
  staff: ["nav-today", "search", "take-tour"],
} as const;
export type RoleTour = keyof typeof ROLE_TOURS;

export const PAGE_TOURS = {
  today: ["today-strip", "today-urgent", "today-numbers", "today-alerts"],
  dispatch: ["board-market", "board-source", "board-map", "board-lanes"],
  inbox: ["inbox-list", "inbox-log-call"],
} as const;
export type PageTour = keyof typeof PAGE_TOURS;

export function roleTourFor(role: string): RoleTour {
  if (role === "super_admin" || role === "ops_manager") return "owner";
  if (role === "dispatcher") return "dispatcher";
  return "staff";
}

/** Joins targets with their translated title and sentence (`texts` from tours.admin.<id>). */
export function buildSteps(
  targets: readonly string[],
  texts: { title: string; body: string }[],
): TourStep[] {
  return targets.map((t, i) => ({
    // On phones the menu items live behind the Menu button: the first visible match is used.
    target:
      t.startsWith("nav-") || t === "take-tour"
        ? `[data-tour="${t}"], [data-tour="menu"]`
        : `[data-tour="${t}"]`,
    title: texts[i]?.title ?? "",
    body: texts[i]?.body ?? "",
  }));
}
