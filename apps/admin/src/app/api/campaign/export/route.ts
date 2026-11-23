import { campaignCsv } from "@rsos/core";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { loadCampaign } from "@/lib/campaign";

export const dynamic = "force-dynamic";

/** Test campaign analytics as CSV (RSOS-089-prep), the numbers that decide the launch city. */
export async function GET(request: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx.role) return new Response("Forbidden", { status: 403 });
  const days = z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .catch(14)
    .parse(request.nextUrl.searchParams.get("days"));
  const csv = campaignCsv(await loadCampaign(days));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="test-campaign-${days}-days.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
