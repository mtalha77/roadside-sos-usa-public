import "server-only";
import { appUrl } from "@rsos/config/site";
import { createAdminSupabase } from "@rsos/db/admin";
import { type Health, getHealth } from "@rsos/db/health";
import { z } from "zod";
import { APPS, type App, sentryStatus } from "./sentry-status";

export { APPS };

const State = z.enum(["real", "fake", "deferred", "missing"]);
const HealthSchema = z.object({
  ok: z.boolean(),
  app: z.enum(APPS),
  environment: z.enum(["production", "staging", "preview", "development"]),
  commit: z.string().nullable(),
  demoMode: z.boolean(),
  database: z.enum(["ok", "error", "not-configured"]),
  serviceKey: z.enum(["match", "mismatch", "unverifiable", "missing", "not-used"]),
  adapters: z.record(z.string(), State),
  rateLimitBackend: z.enum(["upstash", "postgres", "memory"]).optional(),
  demoSignIn: z.enum(["ok", "unavailable"]).optional(),
});

/** Another app's /api/health, parsed; null when it cannot be reached (for example a protected preview). */
async function remoteHealth(app: "web" | "provider"): Promise<Health | null> {
  try {
    const res = await fetch(new URL("/api/health", appUrl(app)), {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const parsed = HealthSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data as Health) : null;
  } catch {
    return null;
  }
}

/** Health of all three apps (this one directly, the others over HTTP). */
export async function allHealth(): Promise<Record<App, Health | null>> {
  const [admin, web, provider] = await Promise.all([
    getHealth("admin"),
    remoteHealth("web"),
    remoteHealth("provider"),
  ]);
  return { web, provider, admin };
}

/**
 * Checks the three apps and records "Sentry live" in `platform_checks` (service role only), which
 * the database uses to gate paid ads and the go-live checklist (owner decision, release 1).
 */
export async function refreshSentryCheck(): Promise<{ ok: boolean; detail: string | null }> {
  const status = sentryStatus(await allHealth());
  try {
    await createAdminSupabase().from("platform_checks").upsert({
      key: "sentry",
      ok: status.ok,
      detail: status.detail,
      checked_at: new Date().toISOString(),
    });
  } catch {
    // Recording failed: the database keeps the previous result, which expires after a day.
  }
  return status;
}
