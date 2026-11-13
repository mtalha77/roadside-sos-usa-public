import "server-only";
import { createServerClient, type CookieMethodsServer, type CookieOptions } from "@supabase/ssr";
import type { Database } from "./database.types";
import { readPublicSupabaseEnv } from "./env";

/** Cookie flags for apps whose session must never be readable by browser scripts (admin). */
export const strictCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Acts as the signed-in user, so Row Level Security applies.
 * Pass the cookie methods from `next/headers` cookies(); pass `strictCookieOptions` for admin.
 */
export function createServerSupabase(cookies: CookieMethodsServer, cookieOptions?: CookieOptions) {
  const env = readPublicSupabaseEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies,
      ...(cookieOptions ? { cookieOptions } : {}),
    },
  );
}
