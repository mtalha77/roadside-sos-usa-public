import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { PublicSupabaseEnvSchema } from "./env";

/**
 * Anonymous client for public website data (definer functions only; no session, no cookies), so
 * results can be cached and shared between visitors. Null when Supabase is not configured.
 */
export function createPublicSupabase() {
  const env = PublicSupabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!env.success) return null;
  return createClient<Database>(
    env.data.NEXT_PUBLIC_SUPABASE_URL,
    env.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
