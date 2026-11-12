import "server-only";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { Database } from "./database.types";
import { readPublicSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Acts as the signed-in user, so Row Level Security applies.
 * Pass the cookie methods from `next/headers` cookies(), e.g.
 *   const store = await cookies();
 *   createServerSupabase({ getAll: () => store.getAll(), setAll: (c) => c.forEach(...) })
 */
export function createServerSupabase(cookies: CookieMethodsServer) {
  const env = readPublicSupabaseEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies },
  );
}
