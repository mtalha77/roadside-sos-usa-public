import "server-only";
import { type AdapterName, type AdapterState, adapterStates } from "@rsos/config/adapters";
import { isDemoMode } from "@rsos/config/demo";
import { type SiteEnv, getSiteEnv } from "@rsos/config/site";
import { createAdminSupabase } from "./admin";
import { serviceKeyStatus, type ServiceKeyStatus } from "./key-check";
import { createPublicSupabase } from "./public";

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

/** Is the database reachable with the public key? (A head request: no rows are read.) */
async function databaseStatus(): Promise<Health["database"]> {
  const supabase = createPublicSupabase();
  if (!supabase) return "not-configured";
  try {
    const { error } = await Promise.race([
      supabase.from("markets").select("id", { head: true, count: "exact" }).limit(1),
      new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error("timeout") }), 4000),
      ),
    ]);
    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}

/**
 * Health report for /api/health: environment, commit, database, the service key's project and
 * each third-party adapter as real, fake or missing. Never includes a value.
 */
export async function getHealth(app: HealthApp): Promise<Health> {
  const demo = isDemoMode();
  const [database, demoSignIn] = await Promise.all([
    databaseStatus(),
    demo && app !== "web" ? demoSignInStatus() : Promise.resolve(undefined),
  ]);
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
    adapters: adapterStates(),
    ...(demoSignIn ? { demoSignIn } : {}),
  };
}
