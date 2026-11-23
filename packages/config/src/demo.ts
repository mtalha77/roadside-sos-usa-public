/**
 * Demo mode (batch 3): screens show realistic fictional data where the backend is not built yet.
 * ON for development, previews and staging when NEXT_PUBLIC_DEMO_MODE=true; ALWAYS OFF in
 * production, whatever the flag says. Values are read one by one so Next.js can inline them in
 * browser bundles.
 */
export function isDemoMode(
  env: { NEXT_PUBLIC_SITE_ENV?: string; NEXT_PUBLIC_DEMO_MODE?: string } = {
    NEXT_PUBLIC_SITE_ENV: process.env.NEXT_PUBLIC_SITE_ENV,
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  },
): boolean {
  const site = env.NEXT_PUBLIC_SITE_ENV ?? "development";
  if (site === "production") return false;
  return env.NEXT_PUBLIC_DEMO_MODE === "true";
}
