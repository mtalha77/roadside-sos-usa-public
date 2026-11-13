import "server-only";
import { createServerSupabase, strictCookieOptions } from "@rsos/db/server";
import { cookies, headers } from "next/headers";

/** Supabase client for account actions: the user's own session, HttpOnly cookies, RLS applies. */
export async function getAccountSupabase() {
  const store = await cookies();
  return createServerSupabase(
    {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; actions and route handlers can.
        }
      },
    },
    strictCookieOptions,
  );
}

/** Caller IP and user agent for the audit log and notices. */
export async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  return { ip, userAgent: h.get("user-agent") ?? "" };
}

export const TRUSTED_DEVICE_COOKIE = "rsos_td";
