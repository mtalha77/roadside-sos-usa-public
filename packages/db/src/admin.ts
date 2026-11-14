import "server-only";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { ServerSupabaseEnvSchema } from "./env";

/**
 * Service-role client. BYPASSES Row Level Security.
 * Server only (the "server-only" import makes the build fail if a Client Component imports this).
 * Use only for trusted back-office work, and check permissions yourself before every call.
 */
export function createAdminSupabase() {
  const env = ServerSupabaseEnvSchema.parse(process.env);
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Password of a demo account (batch 3 demo sign-in, never in production): derived from the
 * service role key so it is never stored or shown, and stable across sign-ins.
 */
export function demoAccountPassword(email: string): string {
  const env = ServerSupabaseEnvSchema.parse(process.env);
  return createHmac("sha256", env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`demo:${email}`)
    .digest("base64url")
    .slice(0, 32);
}
