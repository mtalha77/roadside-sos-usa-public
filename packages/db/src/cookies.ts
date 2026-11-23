import type { CookieOptions } from "@supabase/ssr";

/** Cookie flags for apps whose session must never be readable by browser scripts (admin). */
export const strictCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};
