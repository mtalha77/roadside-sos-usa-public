import { PublicSupabaseEnvSchema } from "@rsos/db";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Liveness check. Reports whether Supabase is configured for this deployment, never any values. */
export async function GET() {
  const configured = PublicSupabaseEnvSchema.safeParse(process.env).success;
  let auth: "not-configured" | "ok" | "error" = "not-configured";
  if (configured) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.getSession();
    auth = error ? "error" : "ok";
  }
  return NextResponse.json(
    { ok: true, supabase: auth },
    { headers: { "Cache-Control": "no-store" } },
  );
}
