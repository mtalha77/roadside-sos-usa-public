import { createServerClient, type CookieMethodsServer, type CookieOptions } from "@supabase/ssr";
import { type AppClaims, parseClaims } from "./claims";
import type { Database } from "./database.types";
import { PublicSupabaseEnvSchema } from "./env";

/** True when this deployment has Supabase configured (previews, staging, production). */
export function supabaseConfigured(): boolean {
  return PublicSupabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).success;
}

/**
 * Refreshes the session from cookies and returns the verified JWT claims (or null).
 * Used by the request proxy of the admin and provider apps. Without Supabase configured, returns null.
 */
export async function getSessionClaims(
  cookies: CookieMethodsServer,
  cookieOptions?: CookieOptions,
): Promise<AppClaims | null> {
  if (!supabaseConfigured()) return null;
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies,
      ...(cookieOptions ? { cookieOptions } : {}),
    },
  );
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return parseClaims(data.claims);
}

/** Supabase auth cookie names start with "sb-"; used to clear an expired session. */
export function isAuthCookie(name: string): boolean {
  return name.startsWith("sb-");
}
