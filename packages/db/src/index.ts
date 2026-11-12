// Browser-safe exports only. Server helpers live in "@rsos/db/server" and "@rsos/db/admin".
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { readPublicSupabaseEnv } from "./env";

export type { Database } from "./database.types";
export { PublicSupabaseEnvSchema, ServerSupabaseEnvSchema } from "./env";

/** Supabase client for Client Components. Uses the publishable key; RLS applies. */
export function createBrowserSupabase() {
  const env = readPublicSupabaseEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
