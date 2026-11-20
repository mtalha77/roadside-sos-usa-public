import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { PublicSupabaseEnvSchema } from "./env";

/**
 * Anonymous client for public website data (definer functions only; no session, no cookies), so
 * results can be cached and shared between visitors. Null when Supabase is not configured.
 * `test: true` sends `x-rsos-test: 1` (test traffic).
 */
export function createPublicSupabase(opts: { test?: boolean } = {}) {
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
      // Owner decision 2: test traffic marks its database calls; the database tags its rows and
      // keeps them out of analytics and ad conversions.
      ...(opts.test ? { global: { headers: { "x-rsos-test": "1" } } } : {}),
    },
  );
}
