import type { Health } from "@rsos/db/health";

export const APPS = ["web", "provider", "admin"] as const;
export type App = (typeof APPS)[number];

/**
 * Sentry is live when every app reports its error tracking as real; the detail names each app that
 * is not (its state, or "unreachable").
 */
export function sentryStatus(all: Record<App, Pick<Health, "adapters"> | null>): {
  ok: boolean;
  detail: string | null;
} {
  const notLive = APPS.flatMap((app) => {
    const state = all[app]?.adapters.sentry ?? "unreachable";
    return state === "real" ? [] : [`${app}: ${state}`];
  });
  return { ok: notLive.length === 0, detail: notLive.length ? notLive.join(", ") : null };
}
