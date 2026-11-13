import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** Email sign-in link lands here: exchange the one-time code for a session, then continue to `next` (home, or the reset-password page). */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const raw = request.nextUrl.searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/sign-in", request.url));
}
