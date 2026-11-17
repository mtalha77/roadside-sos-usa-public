import { LOCALE_COOKIE, resolveLocale } from "@rsos/i18n";
import { createPublicSupabase } from "@rsos/db/public";
import { checkRateLimits, rateLimitKeys } from "@rsos/core/security";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isPlausibleAddress, mapsEnabled } from "@rsos/core/adapters";
import { maps, rateLimitStore } from "@/lib/adapters";
import { messagePage, sharePage } from "@/lib/location-page";

export const dynamic = "force-dynamic";

const Token = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/);
const Link = z.object({
  valid: z.boolean(),
  used: z.boolean(),
  market_slug: z.string(),
  center_lat: z.number(),
  center_lng: z.number(),
  current_address: z.string().nullable(),
});

const html = (body: string, status = 200) =>
  new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });

async function load(token: string) {
  const supabase = createPublicSupabase();
  if (!supabase || !Token.safeParse(token).success) return { supabase, link: null };
  const { data } = await supabase.rpc("get_location_link", { p_token: token });
  const link = Link.safeParse(Array.isArray(data) ? data[0] : null);
  return { supabase, link: link.success ? link.data : null };
}

/** The driver's location page (RSOS-023): one button, a pin to confirm, address fallback. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const locale = resolveLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  const nonce = request.headers.get("x-nonce") ?? "";
  const { link } = await load(token);
  if (!link?.valid) return html(messagePage(locale, nonce, "expired"), 410);
  const error = request.nextUrl.searchParams.get("error");
  return html(
    sharePage({
      locale,
      nonce,
      token,
      currentAddress: link.current_address,
      center: { lat: link.center_lat, lng: link.center_lng },
      mapsKey: mapsEnabled() ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null) : null,
      error: error && /^[a-z]{2,20}$/.test(error) ? error : null,
    }),
  );
}

const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Saves the shared location (GPS pin or typed address), the note and an optional photo. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const locale = resolveLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  const nonce = request.headers.get("x-nonce") ?? "";
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/l/${token}?error=${error}`, request.url), 303);
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const limit = await checkRateLimits(
    [{ key: `location:${rateLimitKeys.ip(ip)}`, limit: 20, windowSeconds: 600 }],
    rateLimitStore(),
  );
  if (!limit.allowed) return back("limit");
  const { supabase, link } = await load(token);
  if (!supabase || !link?.valid) return html(messagePage(locale, nonce, "expired"), 410);

  const form = await request.formData().catch(() => null);
  if (!form) return back("generic");
  const fields = z
    .object({
      lat: z.coerce.number().min(18).max(72).optional(),
      lng: z.coerce.number().min(-180).max(-64).optional(),
      address: z.string().trim().max(300),
      note: z.string().trim().max(300),
    })
    .safeParse({
      lat: form.get("lat") || undefined,
      lng: form.get("lng") || undefined,
      address: form.get("address") ?? "",
      note: form.get("note") ?? "",
    });
  if (!fields.success) return back("generic");
  let { lat, lng } = fields.data;
  let address = fields.data.address;
  if (lat === undefined || lng === undefined) {
    // No GPS: a typed address, checked for format. The dummy maps adapter places it at the market
    // centre (no geocoding while Google Maps is off); the dispatcher confirms it on the call.
    if (address.length < 3) return back("location");
    if (!isPlausibleAddress(address)) return back("address");
    const place = await maps().geocode(address, { lat: link.center_lat, lng: link.center_lng });
    if (!place) return back("address");
    ({ lat, lng } = place);
    address = place.address;
  } else if (!address) {
    const near = await maps().reverseGeocode({ lat, lng });
    if (near) address = near.highway ? `${near.address} (${near.highway})` : near.address;
  }

  // Optional vehicle photo into the private bucket; the storage policy checks the token.
  let photoPath: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const ext = PHOTO_TYPES[photo.type];
    if (!ext || photo.size > 8 * 1024 * 1024) return back("photo");
    const path = `loc/${token}/vehicle-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("job-photos").upload(path, photo, {
      contentType: photo.type,
      upsert: false,
    });
    if (error) return back("photo");
    photoPath = path;
  }

  const { data, error } = await supabase.rpc("submit_location", {
    p_token: token,
    p_lat: lat,
    p_lng: lng,
    p_address: address,
    p_note: fields.data.note || undefined,
    p_photo_path: photoPath ?? undefined,
  });
  if (error || data !== true) return back("generic");
  return html(messagePage(locale, nonce, "done"));
}
