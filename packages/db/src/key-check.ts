/**
 * Checks that SUPABASE_SERVICE_ROLE_KEY belongs to the same Supabase project as
 * NEXT_PUBLIC_SUPABASE_URL, without ever returning or logging either value. A key from another
 * project (for example the dev key on staging) makes demo sign-in and every admin action fail.
 *
 * - match: legacy JWT key with role service_role whose `ref` is the URL's project ref.
 * - mismatch: the key is for another project, or is not a service role key.
 * - unverifiable: a new-style secret key (sb_secret_...), which carries no project ref.
 * - missing: no key (expected on the website, which never uses one).
 */
export type ServiceKeyStatus = "match" | "mismatch" | "unverifiable" | "missing";

type EnvSource = Record<string, string | undefined>;

export function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".supabase.co") ? (host.split(".")[0] ?? null) : null;
  } catch {
    return null;
  }
}

function jwtClaims(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function serviceKeyStatus(env: EnvSource = process.env): ServiceKeyStatus {
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key) return "missing";
  if (key.startsWith("sb_secret_")) return "unverifiable";
  const claims = jwtClaims(key);
  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (!claims || !ref) return "unverifiable";
  return claims.role === "service_role" && claims.ref === ref ? "match" : "mismatch";
}

/** Startup check: logs loudly (names only, never values) when the key is for another project. */
export function assertServiceKeyProject(app: string, env: EnvSource = process.env): void {
  if (serviceKeyStatus(env) === "mismatch")
    console.error(
      `[${app}] SUPABASE_SERVICE_ROLE_KEY does not belong to the Supabase project in ` +
        "NEXT_PUBLIC_SUPABASE_URL. Demo sign-in and admin actions will fail. Set the service " +
        "role key of the matching project for this environment.",
    );
}
