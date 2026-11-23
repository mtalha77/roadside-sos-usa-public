/**
 * Feature flags for work that is not finished (soft launch, 2026-11-23). Every flag is ON outside
 * production, so staging and previews keep showing the work, and OFF in production unless it is
 * listed in NEXT_PUBLIC_FEATURES (comma-separated), so turning one on is a Vercel setting, not a
 * code change. Demo mode is separate and can never be on in production (see demo.ts).
 */
export const FEATURES = {
  /**
   * The provider marketplace screens: incoming offers, jobs, insights, team activity and the
   * portal home's counts. They run on the demo scenario until the quote engine (batch 5) exists,
   * so in production they show empty states instead of fictional requests.
   */
  providerMarketplace: "Provider offers, jobs and insights (quote engine not built yet)",
} as const;
export type FeatureName = keyof typeof FEATURES;

type Env = { NEXT_PUBLIC_SITE_ENV?: string; NEXT_PUBLIC_FEATURES?: string };

export function featureOn(
  name: FeatureName,
  env: Env = {
    NEXT_PUBLIC_SITE_ENV: process.env.NEXT_PUBLIC_SITE_ENV,
    NEXT_PUBLIC_FEATURES: process.env.NEXT_PUBLIC_FEATURES,
  },
): boolean {
  if ((env.NEXT_PUBLIC_SITE_ENV ?? "development") !== "production") return true;
  return (env.NEXT_PUBLIC_FEATURES ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(name);
}

/** Flags that are off in this environment (for the release report and System status). */
export function featuresOff(env?: Env): FeatureName[] {
  return (Object.keys(FEATURES) as FeatureName[]).filter((f) => !featureOn(f, env));
}
