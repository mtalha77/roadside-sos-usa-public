import "server-only";
import { createServerSupabase } from "@rsos/db/server";
import { cookies } from "next/headers";

/**
 * Typed Supabase client (generated `Database` types) for Server Components, Route Handlers
 * and Server Actions. Acts as the signed-in user, so Row Level Security applies.
 */
export async function getServerSupabase() {
  const store = await cookies();
  return createServerSupabase({
    getAll: () => store.getAll(),
    setAll: (cookiesToSet) => {
      try {
        for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
      } catch {
        // Server Components cannot set cookies; the session is refreshed by middleware.
      }
    },
  });
}
