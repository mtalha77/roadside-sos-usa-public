import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { SITE_TAG } from "@/lib/site-data";

/**
 * Refreshes every cached market, service and city page right away (otherwise within 5 minutes).
 * Called by the admin app after a market change. Needs `Authorization: Bearer $REVALIDATE_SECRET`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok =
    Boolean(secret) &&
    given.length === secret!.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  revalidateTag(SITE_TAG, "max");
  return NextResponse.json({ revalidated: true });
}
