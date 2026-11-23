import { z } from "zod";

/** Claims added by the custom access token hook (RSOS-018) plus the standard Supabase ones we use. */
export const StaffRoleSchema = z.enum([
  "super_admin",
  "ops_manager",
  "dispatcher",
  "support",
  "finance",
  "marketing",
  "read_only",
]);
export const ProviderRoleSchema = z.enum(["owner", "manager", "operator"]);

export const AppClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().optional(),
  aal: z.enum(["aal1", "aal2"]).optional(),
  amr: z.array(z.object({ method: z.string(), timestamp: z.number() })).optional(),
  iat: z.number().optional(),
  app_role: z.enum(["staff", "provider", "driver"]).optional(),
  staff_role: StaffRoleSchema.optional(),
  staff_markets: z.array(z.string()).nullable().optional(),
  providers: z.array(z.object({ provider_id: z.string(), role: ProviderRoleSchema })).optional(),
});
export type AppClaims = z.infer<typeof AppClaimsSchema>;

export function parseClaims(raw: unknown): AppClaims | null {
  const parsed = AppClaimsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** When the user signed in (earliest authentication method), in epoch seconds. */
export function sessionStartedAt(claims: AppClaims): number | null {
  const times = (claims.amr ?? []).map((a) => a.timestamp);
  if (times.length) return Math.min(...times);
  return claims.iat ?? null;
}

export const ADMIN_SESSION_SECONDS = 12 * 60 * 60;
export const PROVIDER_SESSION_SECONDS = 30 * 24 * 60 * 60;

export type AccessDecision = "ok" | "sign-in" | "second-step" | "expired" | "forbidden" | "revoked";

/** Admin dashboard: staff only, authenticator app (aal2) required, sessions last 12 hours. */
export function adminAccess(
  claims: AppClaims | null,
  nowSeconds = Date.now() / 1000,
): AccessDecision {
  if (!claims) return "sign-in";
  if (claims.app_role !== "staff" || !claims.staff_role) return "forbidden";
  const started = sessionStartedAt(claims);
  if (started !== null && nowSeconds - started > ADMIN_SESSION_SECONDS) return "expired";
  if (claims.aal !== "aal2") return "second-step";
  return "ok";
}

/** Provider portal: provider members only; sessions last up to 30 days on a trusted device. */
export function providerAccess(
  claims: AppClaims | null,
  nowSeconds = Date.now() / 1000,
): AccessDecision {
  if (!claims) return "sign-in";
  if (claims.app_role !== "provider" || !claims.providers?.length) return "forbidden";
  const started = sessionStartedAt(claims);
  if (started !== null && nowSeconds - started > PROVIDER_SESSION_SECONDS) return "expired";
  return "ok";
}

/** Whether a staff member may see a market (null staff_markets = all markets). */
export function staffCanAccessMarket(claims: AppClaims, marketId: string): boolean {
  if (claims.app_role !== "staff" || claims.aal !== "aal2") return false;
  return !claims.staff_markets || claims.staff_markets.includes(marketId);
}

/**
 * Combines the claim-based decision with the server-side session state (RSOS-093): a session signed
 * out from another device is "revoked" on its next request; providers must pass the second step
 * (emailed code, SMS, authenticator, trusted device or recovery code) before using the portal.
 */
export function withSessionState(
  decision: AccessDecision,
  state: { claims: AppClaims | null; active: boolean; secondStepPassed: boolean },
  opts: { requireSecondStep: boolean },
): AccessDecision {
  if (decision !== "ok") return decision;
  if (!state.active) return "revoked";
  if (opts.requireSecondStep && !state.secondStepPassed && state.claims?.aal !== "aal2")
    return "second-step";
  return "ok";
}
