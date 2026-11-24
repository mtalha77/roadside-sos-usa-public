import "server-only";
import { type AdapterName, type AdapterState, adapterStates } from "@rsos/config/adapters";
import { isDemoMode } from "@rsos/config/demo";
import { type RateLimitBackend, rateLimitBackend } from "@rsos/config/rate-limits";
import { type SiteEnv, getSiteEnv } from "@rsos/config/site";
import { createAdminSupabase } from "./admin";
import { serviceKeyStatus, type ServiceKeyStatus } from "./key-check";
import { createPublicSupabase } from "./public";
import { postgresRateLimitStore } from "./usage";

export type HealthApp = "web" | "provider" | "admin";
export type Health = {
  ok: boolean;
  app: HealthApp;
  environment: SiteEnv;
  commit: string | null;
  demoMode: boolean;
  database: "ok" | "error" | "not-configured";
  /** The website never uses the service role key, so "missing" is expected there. */
  serviceKey: ServiceKeyStatus | "not-used";
  adapters: Record<AdapterName, AdapterState>;
  /** Where rate limits are counted. "memory" means per server instance: not real in production. */
  rateLimitBackend: RateLimitBackend;
  /** Demo mode, provider and admin only: can "Sign in as demo" reach Supabase with the key? */
  demoSignIn?: "ok" | "unavailable";
};

async function demoSignInStatus(): Promise<"ok" | "unavailable"> {
  try {
    const { error } = await createAdminSupabase().auth.admin.listUsers({ page: 1, perPage: 1 });
    return error ? "unavailable" : "ok";
  } catch {
    return "unavailable";
  }
}

/** Is the database reachable with the public key? (A public function for a slug that never exists.) */
async function databaseStatus(): Promise<Health["database"]> {
  const supabase = createPublicSupabase();
  if (!supabase) return "not-configured";
  try {
    const { error } = await Promise.race([
      // A public read function (anonymous visitors cannot select tables directly).
      supabase.rpc("get_market_services", { p_market_slug: "health-check" }),
      new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error("timeout") }), 4000),
      ),
    ]);
    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}

/** The configured rate-limit store, with Postgres proven by one counted hit on a probe key. */
async function rateLimitStatus(): Promise<RateLimitBackend> {
  const backend = rateLimitBackend();
  if (backend !== "postgres") return backend;
  try {
    await postgresRateLimitStore()?.increment("health:probe", 60);
    return "postgres";
  } catch {
    return "memory";
  }
}

/**
 * Health report for /api/health: environment, commit, database, the service key's project and
 * each third-party adapter as real, fake or missing. Never includes a value.
 */
export async function getHealth(app: HealthApp): Promise<Health> {
  const demo = isDemoMode();
  const [database, rateLimit, demoSignIn] = await Promise.all([
    databaseStatus(),
    rateLimitStatus(),
    demo && app !== "web" ? demoSignInStatus() : Promise.resolve(undefined),
  ]);
  const adapters = adapterStates();
  const key = serviceKeyStatus();
  const serviceKey = app === "web" && key === "missing" ? "not-used" : key;
  const keyOk = serviceKey !== "mismatch" && (app === "web" || serviceKey !== "missing");
  return {
    ok: database === "ok" && keyOk && demoSignIn !== "unavailable",
    app,
    environment: getSiteEnv(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    demoMode: demo,
    database,
    serviceKey,
    adapters: {
      ...adapters,
      // The Postgres counter failed its probe: limits fall back to memory per instance.
      ...(rateLimit === "memory" && adapters.rateLimit === "real"
        ? { rateLimit: getSiteEnv() === "production" ? "missing" : "fake" }
        : {}),
    },
    rateLimitBackend: rateLimit,
    ...(demoSignIn ? { demoSignIn } : {}),
  };
}
