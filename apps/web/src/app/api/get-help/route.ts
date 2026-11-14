import { createHash, randomInt } from "node:crypto";
import { brand } from "@rsos/config/brand";
import { legalDocuments } from "@rsos/config/legal";
import { chooseSmsSender } from "@rsos/core";
import { checkRateLimits, rateLimitKeys, verifyTurnstile } from "@rsos/core/security";
import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
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
  VEHICLE_TYPES,
} from "@/lib/get-help";
import { getMarkets, getMarketServices, marketSlugForPoint } from "@/lib/site-data";

type Rpc = (
  fn: string,
  args: object,
) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
const db = () => {
  const s = createPublicSupabase();
  if (!s) throw new Error("Supabase is not configured");
  return s.rpc.bind(s) as unknown as Rpc;
};
const hash = (code: string, token: string) =>
  createHash("sha256").update(`${token}:${code}`).digest("hex");

/**
 * Every Get Help step posts here (plain forms, no JavaScript needed). Each answer is validated,
 * merged into the visitor's draft in the database and the visitor moves to the next step; the last
 * step checks the code, Turnstile, rate limits and duplicates, then creates the request.
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
    // Resume at the first unanswered step: answers already in the draft (a quick repeat request)
    // are not asked again.
    const resume = step === "contact" ? next : currentStep({ ...draft, ...patch });
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
        Number.isFinite(lng);
      const chosen = markets.find((m) => m.slug === str("market"));
      let market: string | null;
      let point: { lat: number; lng: number };
      if (gps) {
        market = await marketSlugForPoint(lat, lng);
        point = { lat, lng };
        if (!market) return go(`/get-help?step=location&outside=1`);
      } else if (chosen && str("address").length >= 3) {
        market = chosen.slug;
        point = { lat: chosen.center_lat, lng: chosen.center_lng };
      } else return fail("location", "location");
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
      return save(
        {
          market,
          ...point,
          approx: !gps,
          address: gps
            ? str("address") || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
            : str("address"),
          note: str("note", 300),
          ...(service ? { service } : {}),
          ...(Object.keys(attribution).length ? { attribution } : {}),
        },
        service ? (NEEDS_DESTINATION.has(service) ? "destination" : "vehicle") : "problem",
      );
    }
    case "problem": {
      const service = str("service", 40);
      const offered = (await getMarketServices(draft.market ?? "")).find(
        (s) => s.service_slug === service,
      );
      if (!offered) return fail("problem", "required");
      if (!offered.enabled) return fail("problem", "service");
      const fu = FOLLOW_UPS[service];
      const followUp = fu ? str(`followUp-${service}`, 20) : "";
      if (fu && !fu.options.includes(followUp)) return fail("problem", "required");
      return save(
        { service, followUp },
        NEEDS_DESTINATION.has(service) ? "destination" : "vehicle",
      );
    }
    case "destination": {
      const p = z
        .object({
          destAddress: z.string().min(3).max(200),
          destMiles: z.enum(Object.keys(MILE_RANGES) as [keyof typeof MILE_RANGES]),
        })
        .safeParse({ destAddress: str("destAddress"), destMiles: str("destMiles") });
      return p.success ? save(p.data, "vehicle") : fail("destination", "required");
    }
    case "vehicle": {
      const p = z
        .object({
          vehicleType: z.enum(VEHICLE_TYPES),
          make: z.string().min(1).max(40),
          model: z.string().max(60),
          color: z.enum(COLORS),
          year: z.number().int().min(1950).max(2100).nullable(),
          ev: z.boolean(),
        })
        .safeParse({
          vehicleType: str("vehicleType"),
          make: str("make", 40),
          model: str("model", 60),
          color: str("color"),
          year: str("year") ? Number(str("year")) : null,
          ev: form.get("ev") === "on",
        });
      return p.success ? save(p.data, "safety") : fail("vehicle", "required");
    }
    case "safety": {
      const quick = str("quick");
      if (quick) {
        // One-tap answers on a quick repeat request.
        const map: Record<string, Draft> = {
          safe: { safe: true, highway: false },
          highway: { safe: true, highway: true },
          unsafe: { safe: false, highway: true },
        };
        return map[quick]
          ? save({ ...map[quick], passengers: 0 }, draft.phone ? "verify" : "contact")
          : fail("safety", "required");
      }
      const safe = str("safe");
      const highway = str("highway");
      if (!["yes", "no"].includes(safe) || !["yes", "no"].includes(highway))
        return fail("safety", "required");
      return save(
        {
          safe: safe === "yes",
          highway: highway === "yes",
          passengers: Math.min(10, Math.max(0, Number(str("passengers")) || 0)),
        },
        "contact",
      );
    }
    case "contact": {
      const phone = toE164(form.get("phone"));
      const name = str("name", 120);
      if (!name) return fail("contact", "required");
      if (!phone) return fail("contact", "phone");
      const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
      const limit = await checkRateLimits([
        { key: `code:${rateLimitKeys.ip(ip)}`, limit: 10, windowSeconds: 3600 },
        { key: `code:${rateLimitKeys.phone(phone)}`, limit: 5, windowSeconds: 3600 },
      ]);
      if (!limit.allowed) return fail("contact", "limit");
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const sms = chooseSmsSender();
      const sent =
        sms.mode === "unavailable"
          ? null
          : await sms.send(
              phone,
              `${brand.shortName}: your code is ${code}. It expires in 10 minutes.`,
            );
      return save(
        {
          name,
          phone,
          codeHash: hash(code, cookieToken ?? ""),
          codeAttempts: 0,
          smsAvailable: Boolean(sent?.ok),
          demoCode: sms.mode === "mock" ? code : "",
        },
        "verify",
      );
    }
    case "verify": {
      if (
        !draft.phone ||
        !draft.market ||
        !draft.service ||
        draft.lat === undefined ||
        draft.lng === undefined
      )
        return go("/get-help");
      // 1. The code (when texts can be sent here); five wrong codes start the number over.
      if (draft.smsAvailable) {
        if ((draft.codeAttempts ?? 0) >= 5) {
          await rpc("save_request_draft", {
            p_token: cookieToken,
            p_patch: { phone: "", codeHash: "" },
          });
          return fail("contact", "locked");
        }
        if (hash(str("code", 6), cookieToken ?? "") !== draft.codeHash) {
          await rpc("save_request_draft", {
            p_token: cookieToken,
            p_patch: { codeAttempts: (draft.codeAttempts ?? 0) + 1 },
          });
          return fail("verify", "code");
        }
      }
      // 2. Turnstile and the per-IP limit.
      const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
      const token = form.get("cf-turnstile-response");
      if (!(await verifyTurnstile(typeof token === "string" ? token : null, { remoteIp: ip })).ok)
        return fail("verify", "turnstile");
      if (
        !(
          await checkRateLimits([
            { key: `request:${rateLimitKeys.ip(ip)}`, limit: 5, windowSeconds: 3600 },
          ])
        ).allowed
      )
        return fail("verify", "limit");
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
            has_passengers: (draft.passengers ?? 0) > 0,
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
            {
              type: "sms_transactional",
              granted: true,
              policy_version: legalDocuments["sms-terms"].version,
            },
          ],
          consent_ip: ip === "unknown" ? null : ip,
          user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300),
          source: "web",
        },
        p_draft_token: cookieToken,
        p_phone_verified: Boolean(draft.smsAvailable),
      });
      const row = Array.isArray(data)
        ? (data[0] as { status_token?: string } | undefined)
        : undefined;
      if (error || !row?.status_token)
        return fail(
          "verify",
          /service area|not available/.test(error?.message ?? "") ? "service" : "generic",
        );
      const res = go(`/r/${row.status_token}`);
      res.cookies.delete(DRAFT_COOKIE);
      return res;
    }
    default:
      return go("/get-help");
  }
}
