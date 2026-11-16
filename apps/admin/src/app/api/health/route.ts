import { isDemoMode } from "@rsos/config/demo";
import { PublicSupabaseEnvSchema } from "@rsos/db";
import { createAdminSupabase } from "@rsos/db/admin";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Liveness check. Reports whether Supabase is configured for this deployment, never any values.
 * In demo mode it also reports whether "Sign in as demo" can reach Supabase with the server key.
 */
export async function GET() {
  const configured = PublicSupabaseEnvSchema.safeParse(process.env).success;
  let auth: "not-configured" | "ok" | "error" = "not-configured";
  if (configured) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.getSession();
    auth = error ? "error" : "ok";
  }
  let demoSignIn: "ok" | "unavailable" | undefined;
  if (isDemoMode()) {
    try {
      const { error } = await createAdminSupabase().auth.admin.listUsers({ page: 1, perPage: 1 });
      demoSignIn = error ? "unavailable" : "ok";
    } catch {
      demoSignIn = "unavailable";
    }
  }
  return NextResponse.json(
    { ok: true, supabase: auth, ...(demoSignIn ? { demoSignIn } : {}) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
