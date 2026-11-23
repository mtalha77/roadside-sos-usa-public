import { googleAdsOfflineCsv } from "@rsos/core/adapters";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Google Ads offline conversions for one day (RSOS-031), in Google's "Google Click ID" upload
 * template, for manual upload while the Ads API developer token is pending. Marketing staff only;
 * RLS limits rows to their markets.
 */
export async function GET(request: NextRequest) {
  const ctx = await getAdminContext();
  if (!["super_admin", "ops_manager", "marketing"].includes(ctx.role))
    return new Response("Forbidden", { status: 403 });
  const day = z.iso.date().safeParse(request.nextUrl.searchParams.get("day"));
  if (!day.success) return new Response("Bad day", { status: 400 });
  const next = new Date(`${day.data}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const { data } = await (
    await getServerSupabase()
  )
    .from("conversion_events")
    .select("gclid, name, occurred_at, value_cents")
    .not("gclid", "is", null)
    .in("name", ["request_submitted", "call_qualified", "job_assigned", "job_completed"])
    .gte("occurred_at", `${day.data}T00:00:00Z`)
    .lt("occurred_at", next.toISOString())
    .order("occurred_at");
  const csv = googleAdsOfflineCsv(
    (data ?? []).map((r) => ({
      gclid: r.gclid ?? "",
      name: r.name,
      occurredAt: r.occurred_at,
      valueCents: r.value_cents,
    })),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="google-ads-conversions-${day.data}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
