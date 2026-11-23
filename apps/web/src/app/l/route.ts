import { LOCALE_COOKIE, resolveLocale } from "@rsos/i18n";
import { createPublicSupabase } from "@rsos/db/public";
import { checkRateLimits, rateLimitKeys } from "@rsos/core/security";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitStore } from "@/lib/adapters";
import { codePage } from "@/lib/location-page";

export const dynamic = "force-dynamic";

const html = (body: string, status = 200) =>
  new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });

/** /l: where the driver types the code the dispatcher read on the call (RSOS-023, no SMS). */
export async function GET(request: NextRequest) {
  const locale = resolveLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  const nonce = request.headers.get("x-nonce") ?? "";
  const error = request.nextUrl.searchParams.get("error");
  return html(codePage(locale, nonce, error && /^[a-z]{2,20}$/.test(error) ? error : null));
}

/** Code to link: 10 tries per IP per 10 minutes, so 6-digit codes cannot be guessed in 2 hours. */
export async function POST(request: NextRequest) {
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/l?error=${error}`, request.url), 303);
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const limit = await checkRateLimits(
    [{ key: `location-code:${rateLimitKeys.ip(ip)}`, limit: 10, windowSeconds: 600 }],
    rateLimitStore(),
  );
  if (!limit.allowed) return back("limit");
  const form = await request.formData().catch(() => null);
  const code = z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/))
    .safeParse(form?.get("code") ?? "");
  if (!code.success) return back("code");
  const supabase = createPublicSupabase();
  if (!supabase) return back("generic");
  const { data } = await supabase.rpc("location_link_for_code", { p_code: code.data });
  const token = z
    .string()
    .regex(/^[A-Za-z0-9_-]{22,64}$/)
    .safeParse(data);
  if (!token.success) return back("code");
  return NextResponse.redirect(new URL(`/l/${token.data}`, request.url), 303);
}
