import { z } from "zod";

/**
 * Deployment environment, set per Vercel environment as NEXT_PUBLIC_SITE_ENV:
 * production (main), staging (staging branch), preview (other branches), development (local).
 */
export const SiteEnvSchema = z.enum(["production", "staging", "preview", "development"]);
export type SiteEnv = z.infer<typeof SiteEnvSchema>;

/** Variables every app needs. Validated at build time on Vercel and at startup. */
export const AppEnvSchema = z
  .object({
    NEXT_PUBLIC_SITE_ENV: SiteEnvSchema,
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  })
  .refine(
    (env) =>
      !(env.NEXT_PUBLIC_SITE_ENV === "production" || env.NEXT_PUBLIC_SITE_ENV === "staging") ||
      env.NEXT_PUBLIC_SITE_URL !== undefined,
    {
      message: "NEXT_PUBLIC_SITE_URL is required on production and staging",
      path: ["NEXT_PUBLIC_SITE_URL"],
    },
  );
export type AppEnv = z.infer<typeof AppEnvSchema>;

type EnvSource = Record<string, string | undefined>;

/**
 * Validates the app environment. On Vercel (VERCEL=1) a missing or invalid value fails the
 * build with the variable NAMES only (never values). Elsewhere (CI, local without .env)
 * it returns null so builds and tests run without secrets.
 */
export function validateAppEnv(env: EnvSource = process.env): AppEnv | null {
  const result = AppEnvSchema.safeParse(env);
  if (result.success) return result.data;
  if (env.VERCEL === "1") {
    const names = [...new Set(result.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  return null;
}

/** Current deployment environment; defaults to development when unset. */
export function getSiteEnv(env: EnvSource = process.env): SiteEnv {
  const parsed = SiteEnvSchema.safeParse(env.NEXT_PUBLIC_SITE_ENV);
  return parsed.success ? parsed.data : "development";
}

/** Only the production website may be indexed by search engines. */
export function isIndexable(
  app: "web" | "provider" | "admin",
  env: EnvSource = process.env,
): boolean {
  return app === "web" && getSiteEnv(env) === "production";
}

/**
 * Absolute base URL of the running app: NEXT_PUBLIC_SITE_URL, else the Vercel branch or
 * deployment URL for previews, else localhost.
 */
export function getSiteUrl(env: EnvSource = process.env, localPort = 3000): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const vercelHost =
    env.NEXT_PUBLIC_VERCEL_BRANCH_URL ??
    env.NEXT_PUBLIC_VERCEL_URL ??
    env.VERCEL_BRANCH_URL ??
    env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  return `http://localhost:${localPort}`;
}
