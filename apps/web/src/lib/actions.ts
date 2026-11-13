"use server";

import { checkRateLimits, rateLimitKeys } from "@rsos/core/security";
import { createPublicSupabase } from "@rsos/db/public";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { MARKET_COOKIE, MARKET_COOKIE_MAX_AGE } from "./market";
import { getMarkets } from "./site-data";

/** Remembers the market the visitor chose (strictly necessary: it decides which number to call). */
export async function chooseMarketAction(form: FormData): Promise<void> {
  const slug = z.string().max(80).safeParse(form.get("market"));
  if (!slug.success) return;
  const markets = await getMarkets();
  if (!markets.some((m) => m.slug === slug.data)) return;
  (await cookies()).set(MARKET_COOKIE, slug.data, {
    path: "/",
    maxAge: MARKET_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: true,
    httpOnly: true,
  });
}

export type WaitlistState = { ok?: boolean; error?: "email" | "zip" | "limit" | "generic" };

const WaitlistSchema = z.object({
  email: z.email().max(254),
  zip: z.union([z.literal(""), z.string().regex(/^\d{5}$/)]),
  city: z.string().max(120).optional(),
  region: z.string().max(10).optional(),
});

/** "Not in your area yet": saves the visitor to `waitlist` (rate limited per IP). */
export async function joinWaitlistAction(_: WaitlistState, form: FormData): Promise<WaitlistState> {
  const parsed = WaitlistSchema.safeParse({
    email: form.get("email"),
    zip: form.get("zip") ?? "",
    city: form.get("city") ?? undefined,
    region: form.get("region") ?? undefined,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "zip" ? "zip" : "email" };
  }
  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const limit = await checkRateLimits([
    { key: `waitlist:${rateLimitKeys.ip(ip)}`, limit: 5, windowSeconds: 3600 },
  ]);
  if (!limit.allowed) return { error: "limit" };
  const supabase = createPublicSupabase();
  if (!supabase) return { error: "generic" };
  const region = parsed.data.region?.toUpperCase();
  const { error } = await supabase.rpc(
    "join_waitlist" as never,
    {
      p: {
        email: parsed.data.email,
        zip: parsed.data.zip || null,
        city: parsed.data.city ?? null,
        state_code: region && /^[A-Z]{2}$/.test(region) ? region : null,
        source: "website",
      },
    } as never,
  );
  return error ? { error: "generic" } : { ok: true };
}
