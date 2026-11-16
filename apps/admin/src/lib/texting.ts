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
}): Promise<{ status: "sent" | "blocked" | "failed"; id: string | null }> {
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
  if (optOut?.opted_out) {
    const { data } = await admin
      .from("sms_messages")
      .insert({ ...base, status: "blocked", status_reason: "opted_out" })
      .select("id")
      .single();
    return { status: "blocked", id: data?.id ?? null };
  }
  const texts = chooseTexts();
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
