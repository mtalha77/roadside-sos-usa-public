import { TRACKING_SOURCES } from "@rsos/core/adapters";
import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMarkets } from "@/lib/site-data";

const Query = z.object({
  market: z.string().regex(/^[a-z0-9-]{2,60}$/),
  source: z.enum(TRACKING_SOURCES),
});

/**
 * Dynamic number insertion (RSOS-030): the number for a market and source (that source's active
 * tracking number, else the website number). Public data, cached at the edge for 5 minutes.
 */
export async function GET(request: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ phone: null }, { status: 400 });
  const market = (await getMarkets()).find((m) => m.slug === parsed.data.market);
  const supabase = createPublicSupabase();
  if (!market || !supabase) return NextResponse.json({ phone: null });
  const { data } = await supabase.rpc("market_phone_for_source", {
    p_market_id: market.id,
    p_source: parsed.data.source,
  });
  return NextResponse.json(
    { phone: typeof data === "string" ? data : null },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
