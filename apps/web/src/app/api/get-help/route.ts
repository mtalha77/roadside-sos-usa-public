import { isDemoMode } from "@rsos/config/demo";
import {
  effectsOf,
  QUESTIONS_VERSION,
  tagsOf,
  validateAnswers,
} from "@rsos/core/service-questions";
import { legalDocuments } from "@rsos/config/legal";
import { isPlausibleAddress } from "@rsos/core/adapters";
import { checkRateLimits, rateLimitKeys, verifyTurnstile } from "@rsos/core/security";
import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  COLORS,
  type Draft,
  DraftSchema,
  DRAFT_COOKIE,
  VEHICLE_TYPES,
  MILE_RANGES,
  NEEDS_DESTINATION,
  currentStep,
  toE164,
} from "@/lib/get-help";
import { maps, rateLimitStore } from "@/lib/adapters";
import { ATTRIBUTION_COOKIE, decodeAttribution } from "@/lib/attribution";
import { getQuestionOverrides } from "@/lib/questions";
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
  // The client flow layer (RSOS-116) asks for JSON so it can push or replace history itself.
  const asJson = request.headers.get("x-flow") === "1";
  const go = (to: string, token?: string) => {
    const res = asJson
      ? NextResponse.json({ to })
      : NextResponse.redirect(new URL(to, request.url), 303);
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
  const svcOf = () => draft.service || str("service", 40) || "";
  const stepUrl = (s: string, svc = svcOf()) => (svc ? `/get-help/${svc}/${s}` : "/get-help");
  const fail = (s: string, error: string, extra = "") => go(`${stepUrl(s)}?error=${error}${extra}`);
  const save = async (patch: Draft, next: string) => {
    const { data, error } = await rpc("save_request_draft", {
      p_token: cookieToken,
      p_patch: patch,
    });
    if (error) return fail(step, "generic");
    // Resume at the first unanswered step (answers already in the draft are not asked again),
    // except when the location step asks to come back to itself (GPS saved: show the pin).
    const resume = next === "stay" ? "location" : currentStep({ ...draft, ...patch });
    return go(stepUrl(resume, patch.service ?? svcOf()), String(data));
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
          : go(`${stepUrl("location")}?error=${error}`, String(data));
      };
      let market: string | null;
      let point: { lat: number; lng: number };
      let precise = gps;
      let address = str("address");
      if (gps) {
        market = await marketSlugForPoint(lat, lng);
        point = { lat, lng };
        if (!market) return go(`${stepUrl("location")}?outside=1`);
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
      if (!offered) return go("/get-help?error=required");
      // RSOS-116: the service's questions, validated with the market's overrides.
      const raw = Object.fromEntries(
        [...form.entries()].flatMap(([k, v]) =>
          k.startsWith("q.") && typeof v === "string" ? [[k.slice(2), v.slice(0, 200)]] : [],
        ),
      );
      const overrides = await getQuestionOverrides(market || null);
      const checked = validateAnswers(service, raw, overrides);
      const notes = str("notes", 500);
      const kept = checked.ok
        ? checked.answers
        : (Object.fromEntries(
            Object.entries(raw).filter(([, v]) => typeof v === "string" && v),
          ) as Record<string, string>);
      // Switching service keeps location, vehicle and contact; only the answers change.
      const patch: Draft = {
        service,
        answers: kept,
        notes,
        ...(service === "tow" &&
        kept.vehicleType &&
        VEHICLE_TYPES.includes(kept.vehicleType as never)
          ? { vehicleType: kept.vehicleType as Draft["vehicleType"] }
          : {}),
        ...(service === "wont-start" && kept.electric ? { ev: kept.electric === "yes" } : {}),
      };
      const { data: saved, error: saveError } = await rpc("save_request_draft", {
        p_token: cookieToken,
        p_patch: patch,
      });
      if (saveError) return fail("problem", "generic");
      const token = String(saved);
      // Up to 3 photos (compressed on the device when JavaScript runs), private storage.
      const photos = form
        .getAll("photos")
        .filter((f): f is File => f instanceof File && f.size > 0 && f.size <= 8_000_000)
        .filter((f) => /^image\/(jpeg|png|webp|heic)$/.test(f.type))
        .slice(0, 3);
      if (photos.length) {
        const supabase = createPublicSupabase();
        const paths: string[] = [];
        for (const [n, f] of photos.entries()) {
          const ext = f.type === "image/jpeg" ? "jpg" : f.type.split("/")[1]!;
          const path = `draft/${token}/${n}.${ext}`;
          const up = await supabase?.storage
            .from("job-photos")
            .upload(path, f, { contentType: f.type, upsert: true });
          if (up && !up.error) paths.push(path);
        }
        await rpc("save_request_draft", { p_token: token, p_patch: { photos: paths } });
      }
      if (!checked.ok) {
        const r = go(
          `${stepUrl("problem", service)}?error=required&missing=${checked.missing.join(",")}`,
          token,
        );
        return r;
      }
      return go(stepUrl(currentStep({ ...draft, ...patch }), service), token);
    }
    case "details": {
      if (!draft.market || !draft.service || draft.lat === undefined || draft.lng === undefined)
        return go("/get-help");
      const phone = toE164(form.get("phone"));
      const name = str("name", 120);
      const rawEmail = str("email", 254).toLowerCase();
      const email = rawEmail ? Email.safeParse(rawEmail) : null;
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
        plate: str("plate", 12).toUpperCase(),
        ...(/^(19|20)\d{2}$/.test(str("year", 4)) ? { year: Number(str("year", 4)) } : {}),
      };
      // Keep what was typed, even when something is missing (the screen comes back filled in).
      await rpc("save_request_draft", { p_token: cookieToken, p_patch: patch });
      Object.assign(draft, patch);
      if (!name) return fail("details", "name");
      if (!phone) return fail("details", "phone");
      if (email && !email.success) return fail("details", "email");
      if (!vehicle.success) return fail("details", "vehicle");
      const safety = str("q.safety", 20);
      if (!draft.answers?.safety && ["safe", "shoulder", "lane"].includes(safety)) {
        draft.answers = { ...draft.answers, safety };
        await rpc("save_request_draft", {
          p_token: cookieToken,
          p_patch: { answers: draft.answers },
        });
      }
      if (!draft.answers?.safety) return fail("details", "spot", "&missing=safety");
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
      const a = draft.answers ?? {};
      const effects = effectsOf(draft.service, a);
      const tags = tagsOf(draft.service, a);
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
            safe_spot: a.safety === "safe",
            on_highway: a.safety === "shoulder" || a.safety === "lane",
            has_passengers: Number(a.people ?? 0) > 0,
            spare_available:
              draft.service === "flat-tire" ? a.spare === "full" || a.spare === "donut" : null,
            keys_available:
              draft.service === "locked-out"
                ? a.keysWhere === "inside" || a.keysWhere === "trunk"
                : null,
          },
          notes: [
            draft.service,
            tags.length ? tags.join(", ") : null,
            draft.notes || null,
            draft.plate ? `plate ${draft.plate}` : null,
            draft.approx ? "location typed, not GPS" : null,
          ]
            .filter(Boolean)
            .join("; "),
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
      // RSOS-116: the structured answers, photos and timing, attached with the status token.
      const whenAt = a.when === "later" && a.whenAt ? new Date(a.whenAt) : null;
      await rpc("set_request_answers", {
        p_token: row.status_token,
        p_draft_token: cookieToken,
        p_answers: a,
        p_version: QUESTIONS_VERSION,
        p_photos: (draft.photos ?? []).filter(
          (x) => cookieToken && x.startsWith(`draft/${cookieToken}/`),
        ),
        p_scheduled_for: whenAt && !Number.isNaN(whenAt.getTime()) ? whenAt.toISOString() : null,
        p_urgent: effects.includes("urgent"),
      });
      const res = go(`/r/${row.status_token}`);
      res.cookies.delete(DRAFT_COOKIE);
      return res;
    }
    default:
      return go(stepUrl(currentStep(draft)));
  }
}
