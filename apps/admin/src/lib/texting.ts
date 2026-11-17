import "server-only";
import { brand } from "@rsos/config/brand";
import { chooseTexts, segmentCount } from "@rsos/core/adapters";
import { createAdminSupabase } from "@rsos/db/admin";
import { getMessages } from "@rsos/i18n";

/**
 * Sends one text and records it (RSOS-030, extended in RSOS-035). Opted-out numbers are blocked
 * in our code too, not only at Twilio. The first text to a new number carries the STOP notice.
 * Without Twilio keys (previews, demo, staging before setup) the fake records it and sends nothing.
 */
export async function sendText(o: {
  marketId: string;
  requestId?: string | null;
  to: string;
  body: string;
  from: string;
  urgent?: boolean;
  templateKey?: string;
  staffUserId?: string | null;
  statusCallback?: string;
}): Promise<{ status: "sent" | "blocked" | "held" | "failed"; id: string | null }> {
  const admin = createAdminSupabase();
  const [{ data: optOut }, { count: prior }] = await Promise.all([
    admin.from("sms_opt_outs").select("opted_out").eq("phone", o.to).maybeSingle(),
    admin
      .from("sms_messages")
      .select("id", { count: "exact", head: true })
      .eq("to_phone", o.to)
      .eq("direction", "outbound")
      .in("status", ["sent", "delivered"]),
  ]);
  const notice = getMessages("en").texts.stopNotice;
  const body = prior ? o.body : `${o.body} ${notice}`.trim();
  const base = {
    market_id: o.marketId,
    request_id: o.requestId ?? null,
    direction: "outbound" as const,
    from_phone: o.from,
    to_phone: o.to,
    body,
    template_key: o.templateKey ?? null,
    urgent: o.urgent ?? false,
    staff_user_id: o.staffUserId ?? null,
    segments: segmentCount(body),
  };
  const texts = chooseTexts();
  const hold = await holdReason({
    marketId: o.marketId,
    to: o.to,
    urgent: o.urgent ?? false,
    realSend: texts.mode === "real",
  });
  if (hold && !optOut?.opted_out) {
    const { data } = await admin
      .from("sms_messages")
      .insert({ ...base, status: "held", status_reason: hold })
      .select("id")
      .single();
    return { status: "held", id: data?.id ?? null };
  }
  if (optOut?.opted_out) {
    const { data } = await admin
      .from("sms_messages")
      .insert({ ...base, status: "blocked", status_reason: "opted_out" })
      .select("id")
      .single();
    return { status: "blocked", id: data?.id ?? null };
  }
  const sent = await texts.send({ to: o.to, body, statusCallback: o.statusCallback });
  const { data } = await admin
    .from("sms_messages")
    .insert({
      ...base,
      twilio_sid: sent.ok ? sent.sid : null,
      status: sent.ok ? "sent" : "failed",
      status_reason: texts.mode === "fake" ? "fake" : null,
      error_code: sent.ok ? null : (sent.code ?? null),
      segments: sent.ok ? (sent.segments ?? base.segments) : base.segments,
    })
    .select("id")
    .single();
  return { status: sent.ok ? "sent" : "failed", id: data?.id ?? null };
}

/** "{brand}" in a message, filled from config. */
export const withBrand = (s: string) => s.replaceAll("{brand}", brand.name);

/** 9pm to 8am in the market's time zone: no non-urgent texts (RSOS-035). */
export function inQuietHours(timeZone: string, at = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(at),
  );
  return hour >= 21 || hour < 8;
}

/**
 * Why a text must wait instead of going out now, or null:
 * - quiet_hours: a non-urgent text between 9pm and 8am in the market's time zone;
 * - a2p_pending: a real send to anyone but a test number before A2P 10DLC registration is
 *   approved, unless the owner turned on the override (Admin > Settings > Texts).
 */
async function holdReason(o: {
  marketId: string;
  to: string;
  urgent: boolean;
  realSend: boolean;
}): Promise<"quiet_hours" | "a2p_pending" | null> {
  const admin = createAdminSupabase();
  if (!o.urgent) {
    const { data: market } = await admin
      .from("markets")
      .select("time_zone")
      .eq("id", o.marketId)
      .maybeSingle();
    if (market?.time_zone && inQuietHours(market.time_zone)) return "quiet_hours";
  }
  if (!o.realSend) return null;
  const { data: setting } = await admin
    .from("system_settings")
    .select("value")
    .eq("key", "a2p_10dlc")
    .maybeSingle();
  const value = (setting?.value ?? {}) as { status?: unknown; override?: unknown };
  if (value.status === "approved" || value.override === true) return null;
  if (o.to === process.env.OWNER_TEST_PHONE) return null;
  const { count } = await admin
    .from("staff_members")
    .select("user_id", { count: "exact", head: true })
    .eq("mobile_phone", o.to);
  return count ? null : "a2p_pending";
}

/** A template from the database with its placeholders filled ({brand} from config). */
export async function renderTemplate(
  key: string,
  vars: Record<string, string>,
  locale: "en" | "es" = "en",
): Promise<{ body: string; urgent: boolean } | null> {
  const { data } = await createAdminSupabase()
    .from("sms_templates")
    .select("body_en, body_es, urgent")
    .eq("key", key)
    .maybeSingle();
  if (!data) return null;
  const all: Record<string, string> = { brand: brand.name, support: brand.emails.support, ...vars };
  const body = (locale === "es" ? data.body_es : data.body_en).replace(
    /\{(\w+)\}/g,
    (m, k: string) => all[k] ?? m,
  );
  return { body, urgent: data.urgent };
}
