import { isDemoMode } from "@rsos/config/demo";
import { legalDocuments } from "@rsos/config/legal";
import { isPlausibleAddress, SOURCE_COOKIE } from "@rsos/core/adapters";
import { checkRateLimits, rateLimitKeys, verifyTurnstile } from "@rsos/core/security";
import { createPublicSupabase } from "@rsos/db/public";
import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  COLORS,
  type Draft,
  DraftSchema,
  DRAFT_COOKIE,
  FOLLOW_UPS,
  MILE_RANGES,
  NEEDS_DESTINATION,
  currentStep,
  toE164,
} from "@/lib/get-help";
import { maps, rateLimitStore } from "@/lib/adapters";
import { ATTRIBUTION_COOKIE, decodeAttribution } from "@/lib/attribution";
import { deviceOf, FLOW_COOKIE, readFlow, recordFunnel } from "@/lib/funnel";
import { getMarkets, getMarketServices, getServices, marketSlugForPoint } from "@/lib/site-data";

type Rpc = (
  fn: string,
  args: object,
) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const db = () => {
  const s = createPublicSupabase();
  if (!s) throw new Error("Supabase is not configured");
  return s.rpc.bind(s) as unknown as Rpc;
};
/**
 * Production limit (RSOS-021b): 5 requests per IP per hour. Demo-mode previews and staging allow
 * more because test suites submit from one IP.
 */
const LIMITS = isDemoMode() ? { requestIp: 100 } : { requestIp: 5 };
const Email = z.email().max(254);

/**
 * Every Get Help screen posts here (plain forms, no JavaScript needed). Each answer is validated,
 * merged into the visitor's draft in the database and the visitor moves on; the last screen
 * (details) checks Turnstile, rate limits and duplicates, then creates the request (RSOS-101).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const step = String(form.get("step") ?? "");
  const rpc = db();
  const cookieToken = request.cookies.get(DRAFT_COOKIE)?.value ?? null;
  const { data: rawDraft } = cookieToken
    ? await rpc("get_request_draft", { p_token: cookieToken })
    : { data: null };
  const draft: Draft = DraftSchema.parse(rawDraft ?? {});
  const go = (to: string, token?: string) => {
    const res = NextResponse.redirect(new URL(to, request.url), 303);
    if (token)
      res.cookies.set(DRAFT_COOKIE, token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        maxAge: 86_400,
      });
    return res;
  };
  const fail = (s: string, error: string) => go(`/get-help?step=${s}&error=${error}`);
  const save = async (patch: Draft, next: string) => {
    const { data, error } = await rpc("save_request_draft", {
      p_token: cookieToken,
      p_patch: patch,
    });
    if (error) return fail(step, "generic");
    // Resume at the first unanswered step (answers already in the draft are not asked again),
    // except when the location step asks to come back to itself (GPS saved: show the pin).
    const resume = next === "stay" ? "location" : currentStep({ ...draft, ...patch });
    return go(`/get-help?step=${resume}`, String(data));
  };
  const str = (k: string, max = 200) =>
    String(form.get(k) ?? "")
      .trim()
      .slice(0, max);

  switch (step) {
    case "location": {
      const markets = await getMarkets();
      const lat = Number(form.get("lat"));
      const lng = Number(form.get("lng"));
      const gps =
        form.get("lat") !== "" &&
        form.get("lat") !== null &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        // A saved fix (shown again after Back) gives way to an address the driver types now.
        !(form.get("fix") === "saved" && str("address").length >= 3);
      const chosen = markets.find((m) => m.slug === str("market"));
      const placeId = str("placeId", 300);
      // An error keeps what was typed: the tile's service, the address and the city are saved
      // to the draft first, so the location screen comes back filled in (not the first screen).
      const keep = async (error: string) => {
        const posted = str("service", 40);
        const patch: Draft = {
          ...(/^[a-z-]{2,40}$/.test(posted) && !draft.service ? { service: posted } : {}),
          ...(chosen ? { market: chosen.slug } : {}),
          ...(str("address").length ? { address: str("address"), approx: true } : {}),
        };
        if (!Object.keys(patch).length) return fail("location", error);
        const { data, error: saveError } = await rpc("save_request_draft", {
          p_token: cookieToken,
          p_patch: patch,
        });
        return saveError
          ? fail("location", error)
          : go(`/get-help?step=location&error=${error}`, String(data));
      };
      let market: string | null;
      let point: { lat: number; lng: number };
      let precise = gps;
      let address = str("address");
      if (gps) {
        market = await marketSlugForPoint(lat, lng);
        point = { lat, lng };
        if (!market) return go(`/get-help?step=location&outside=1`);
        // A readable address and the nearest highway for the provider (real Maps only).
        const near = await maps().reverseGeocode(point);
        if (near && !address)
          address = near.highway ? `${near.address} (${near.highway})` : near.address;
      } else if (chosen && address.length >= 3) {
        // A typed address is checked for format only (no geocoding while Google Maps is off).
        if (!placeId && !isPlausibleAddress(address)) return keep("address");
        market = chosen.slug;
        point = { lat: chosen.center_lat, lng: chosen.center_lng };
        // A suggestion picked from Places Autocomplete gives the exact point.
        const m = maps();
        const place = placeId && m.mode === "real" ? await m.place(placeId) : null;
        if (place) {
          const inMarket = await marketSlugForPoint(place.lat, place.lng);
          if (inMarket) {
            market = inMarket;
            point = { lat: place.lat, lng: place.lng };
            address = place.address;
            precise = true;
          }
        }
      } else return keep("location");
      const service = str("service", 40);
      const attribution = Object.fromEntries(
        [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
          "gclid",
          "gbraid",
          "wbraid",
          "fbclid",
          "msclkid",
          "landing_page",
        ]
          .map((k) => [k, str(k)])
          .filter(([, v]) => v),
      );
      // First-touch attribution from the visitor's cookie fills what this page's URL lacks
      // (RSOS-031: a gclid from the ad click reaches the request even after browsing around).
      const firstTouch = decodeAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value);
      if (firstTouch)
        for (const [k, v] of Object.entries(firstTouch))
          if (v && k !== "market" && !(k in attribution)) attribution[k] = v;
      // A tow (or winch out) also needs where to take the vehicle, asked on this screen.
      const svc = service || draft.service || "";
      let destination: Draft = {};
      const stay = str("stay") === "1";
      if (NEEDS_DESTINATION.has(svc) && !stay) {
        const d = z
          .object({
            destAddress: z.string().min(3).max(200),
            destMiles: z.enum(Object.keys(MILE_RANGES) as [keyof typeof MILE_RANGES]),
          })
          .safeParse({ destAddress: str("destAddress"), destMiles: str("destMiles") || "lt5" });
        if (!d.success) return keep("destination");
        destination = d.data;
      }
      return save(
        {
          market,
          ...point,
          approx: !precise,
          address: address || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
          note: str("note", 300),
          ...(service ? { service } : {}),
          ...destination,
          ...(Object.keys(attribution).length ? { attribution } : {}),
        },
        stay ? "stay" : "details",
      );
    }
    case "problem": {
      const service = str("service", 40);
      // Before the location is known, any service offered somewhere; the market is checked again
      // when the request is created.
      const market = draft.market ?? str("market", 60);
      const offered = market
        ? (await getMarketServices(market)).find((s) => s.service_slug === service && s.enabled)
        : (await getServices()).find((s) => s.slug === service && s.market_count > 0);
      if (!offered) return fail("problem", "required");
      const fu = FOLLOW_UPS[service];
      const followUp = fu ? str(`followUp-${service}`, 20) : "";
      return save(
        { service, followUp: fu && fu.options.includes(followUp) ? followUp : "" },
        "location",
      );
    }
    case "details": {
      if (!draft.market || !draft.service || draft.lat === undefined || draft.lng === undefined)
        return go("/get-help");
      const phone = toE164(form.get("phone"));
      const name = str("name", 120);
      const rawEmail = str("email", 254).toLowerCase();
      const email = rawEmail ? Email.safeParse(rawEmail) : null;
      const spot = str("spot");
      const vehicle = z
        .object({
          make: z.string().min(1).max(40),
          model: z.string().max(60),
          color: z.enum(COLORS),
        })
        .safeParse({ make: str("make", 40), model: str("model", 60), color: str("color") });
      const patch: Draft = {
        name,
        phone: phone ?? "",
        email: email?.success ? email.data : "",
        ...(vehicle.success ? vehicle.data : {}),
        ...(spot === "safe" || spot === "highway" || spot === "unsafe"
          ? { safe: spot !== "unsafe", highway: spot !== "safe" }
          : {}),
      };
      // Keep what was typed, even when something is missing (the screen comes back filled in).
      await rpc("save_request_draft", { p_token: cookieToken, p_patch: patch });
      Object.assign(draft, patch);
      if (!name) return fail("details", "name");
      if (!phone) return fail("details", "phone");
      if (email && !email.success) return fail("details", "email");
      if (!vehicle.success) return fail("details", "vehicle");
      if (draft.safe === undefined) return fail("details", "spot");
      // 2. Turnstile and the per-IP limit.
      const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
      const token = form.get("cf-turnstile-response");
      if (!(await verifyTurnstile(typeof token === "string" ? token : null, { remoteIp: ip })).ok)
        return fail("details", "turnstile");
      if (
        !(
          await checkRateLimits(
            [
              {
                key: `request:${rateLimitKeys.ip(ip)}`,
                limit: LIMITS.requestIp,
                windowSeconds: 3600,
              },
            ],
            rateLimitStore(),
          )
        ).allowed
      )
        return fail("details", "limit");
      // 3. Same phone within 30 minutes: open that request instead of creating a second one.
      const { data: existing } = await rpc("find_recent_request", { p_phone: draft.phone });
      if (typeof existing === "string" && existing) return go(`/r/${existing}`);
      // 4. Create it.
      const followLabel = draft.followUp ? ` (${draft.followUp})` : "";
      const { data, error } = await rpc("submit_web_request", {
        p: {
          market_slug: draft.market,
          service_slug: draft.service,
          driver_name: draft.name,
          driver_phone: draft.phone,
          pickup: {
            lat: draft.lat,
            lng: draft.lng,
            address: draft.address,
            note: draft.note || null,
          },
          ...(draft.destAddress
            ? {
                destination: {
                  address: `${draft.destAddress} (about ${MILE_RANGES[draft.destMiles ?? "lt5"]} mi)`,
                },
              }
            : {}),
          vehicle: {
            type: draft.vehicleType,
            make: draft.make,
            model: draft.model,
            color: draft.color,
            year: draft.year,
            is_ev: draft.ev,
          },
          situation: {
            safe_spot: draft.safe,
            on_highway: draft.highway,
            has_passengers: false,
            spare_available: draft.service === "flat-tire" ? draft.followUp === "yes" : null,
            keys_available: draft.service === "locked-out" ? draft.followUp === "inside" : null,
          },
          notes: `${draft.service}${followLabel}${draft.approx ? "; location typed, not GPS" : ""}`,
          attribution: {
            ...draft.attribution,
            referrer: request.headers.get("referer") ?? null,
            device: /Mobi/.test(request.headers.get("user-agent") ?? "") ? "mobile" : "desktop",
          },
          consents: [
            {
              type: "terms",
              granted: true,
              policy_version: legalDocuments["driver-terms"].version,
            },
            { type: "privacy", granted: true, policy_version: legalDocuments.privacy.version },
          ],
          consent_ip: ip === "unknown" ? null : ip,
          user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
          source: "web",
        },
        p_draft_token: cookieToken,
        p_email: draft.email ?? "",
        // The email is stored for updates but not checked with a code: a code would be a fourth
        // screen for someone stranded (RSOS-101). It is never used to sign in.
        p_email_verified: false,
      });
      const row = Array.isArray(data)
        ? (data[0] as { status_token?: string } | undefined)
        : undefined;
      if (error || !row?.status_token)
        return fail(
          "details",
          /service area|not available/.test(error?.message ?? "") ? "service" : "generic",
        );
      // Booking funnel (RSOS-111): submitted, with the seconds since this session landed.
      const flow = readFlow(request.cookies.get(FLOW_COOKIE)?.value);
      if (flow)
        after(() =>
          recordFunnel({
            session: flow.session,
            event: "submitted",
            step: "details",
            market: draft.market ?? null,
            source: request.cookies.get(SOURCE_COOKIE)?.value ?? null,
            device: deviceOf(request.headers.get("user-agent")),
            landingSec: (Date.now() - flow.landedAt) / 1000,
            requestToken: row.status_token ?? null,
          }),
        );
      const res = go(`/r/${row.status_token}`);
      res.cookies.delete(DRAFT_COOKIE);
      return res;
    }
    default:
      return go("/get-help");
  }
}
