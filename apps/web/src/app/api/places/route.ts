import { checkRateLimits, rateLimitKeys, rateLimitResponse } from "@rsos/core/security";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { maps, rateLimitStore } from "@/lib/adapters";
import { getMarkets } from "@/lib/site-data";

export const dynamic = "force-dynamic";

const Query = z.object({
  q: z.string().trim().min(3).max(120),
  market: z
    .string()
    .regex(/^[a-z0-9-]{2,60}$/)
    .optional(),
  session: z
    .string()
    .regex(/^[A-Za-z0-9-]{8,64}$/)
    .optional(),
});

/**
 * Address suggestions for Get Help (RSOS-021b): Places Autocomplete (New), US only, biased to the
 * selected market. The server key never reaches the browser. 60 lookups per IP per minute.
 */
export async function GET(request: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ suggestions: [] });
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const limited = rateLimitResponse(
    await checkRateLimits(
      [{ key: `places:${rateLimitKeys.ip(ip)}`, limit: 60, windowSeconds: 60 }],
      rateLimitStore(),
    ),
  );
  if (limited) return limited;
  const market = parsed.data.market
    ? (await getMarkets()).find((m) => m.slug === parsed.data.market)
    : undefined;
  const suggestions = await maps().autocomplete(parsed.data.q, {
    bias: market ? { lat: market.center_lat, lng: market.center_lng } : undefined,
    sessionToken: parsed.data.session,
  });
  return NextResponse.json(
    { suggestions: suggestions.slice(0, 5) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
