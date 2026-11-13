import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MARKET_COOKIE, MARKET_COOKIE_MAX_AGE } from "@/lib/market";
import { safeReturn } from "@/lib/return-path";
import { getMarkets } from "@/lib/site-data";

/** Remembers the area the visitor chose (strictly necessary: it decides which number to call). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const res = NextResponse.redirect(new URL(safeReturn(form.get("return")), request.url), 303);
  const slug = z.string().max(80).safeParse(form.get("market"));
  if (slug.success && (await getMarkets()).some((m) => m.slug === slug.data)) {
    res.cookies.set(MARKET_COOKIE, slug.data, {
      path: "/",
      maxAge: MARKET_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      httpOnly: true,
    });
  }
  return res;
}
