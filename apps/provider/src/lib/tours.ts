import type { TourStep } from "@rsos/ui/tour";

/**
 * Provider portal tours (RSOS-105), one per role, on first sign-in: going online, receiving an
 * offer, sending a quote, updating a job and (owners) the wallet. Texts: tours.provider.<role>.
 */
export const PROVIDER_TOURS = {
  owner: ["online", "offers", "offers", "nav-jobs", "nav-wallet", "take-tour"],
  manager: ["online", "offers", "offers", "nav-jobs", "take-tour"],
  operator: ["tech-active", "tech-active", "nav-account"],
} as const;
export type ProviderTour = keyof typeof PROVIDER_TOURS;

const FALLBACK: Record<string, string> = {
  "take-tour": "nav-more",
  "tech-active": "nav-jobs",
};

export function providerSteps(
  role: ProviderTour,
  texts: { title: string; body: string }[],
): TourStep[] {
  return PROVIDER_TOURS[role].map((t, i) => ({
    // The first visible match wins: side menu on desktop, tabs (or More) on phones.
    target: [t, FALLBACK[t]]
      .filter(Boolean)
      .map((x) => `[data-tour="${x}"]`)
      .join(", "),
    title: texts[i]?.title ?? "",
    body: texts[i]?.body ?? "",
  }));
}
