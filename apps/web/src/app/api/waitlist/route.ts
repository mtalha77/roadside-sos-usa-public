import { checkRateLimits, rateLimitKeys } from "@rsos/core/security";
import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeReturn } from "@/lib/return-path";
import { WAITLIST_FLASH, type WaitlistResult } from "@/lib/waitlist";

const Form = z.object({
  email: z.email().max(254),
  zip: z.union([z.literal(""), z.string().regex(/^\d{5}$/)]),
  city: z.string().max(120),
  region: z.string().max(10),
});

/** "Not in your area yet": saves the visitor to `waitlist` (rate limited per IP), then goes back. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const back = new URL(safeReturn(form.get("return")), request.url);
  back.hash = "waitlist";
  const done = (result: WaitlistResult) => {
    const res = NextResponse.redirect(back, 303);
    res.cookies.set(WAITLIST_FLASH, result, {
      path: "/",
      maxAge: 60,
      sameSite: "lax",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
    });
    return res;
  };
  const parsed = Form.safeParse({
    email: form.get("email"),
    zip: form.get("zip") ?? "",
    city: form.get("city") ?? "",
    region: form.get("region") ?? "",
  });
  if (!parsed.success) return done(parsed.error.issues[0]?.path[0] === "zip" ? "zip" : "email");
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const limit = await checkRateLimits([
    { key: `waitlist:${rateLimitKeys.ip(ip)}`, limit: 5, windowSeconds: 3600 },
  ]);
  if (!limit.allowed) return done("limit");
  const supabase = createPublicSupabase();
  if (!supabase) return done("generic");
  const region = parsed.data.region.toUpperCase();
  const { error } = await supabase.rpc(
    "join_waitlist" as never,
    {
      p: {
        email: parsed.data.email,
        zip: parsed.data.zip || null,
        city: parsed.data.city || null,
        state_code: /^[A-Z]{2}$/.test(region) ? region : null,
        source: "website",
      },
    } as never,
  );
  return done(error ? "generic" : "joined");
}
