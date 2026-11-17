import "server-only";
import { brand } from "@rsos/config/brand";
import { createAdminSupabase } from "@rsos/db/admin";
import { getMessages } from "@rsos/i18n";
import { sendText } from "@/lib/texting";

const E164 = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START = new Set(["START", "UNSTOP", "YES"]);
const HELP = new Set(["HELP", "INFO"]);

export type Keyword = "stop" | "start" | "help" | null;
export function keywordOf(body: string): Keyword {
  const word = body
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (STOP.has(word)) return "stop";
  if (START.has(word)) return "start";
  if (HELP.has(word)) return "help";
  return null;
}

/**
 * An incoming text (RSOS-034b, RSOS-035): opt-out keywords update our own record (Twilio's
 * Messaging Service also handles them); HELP answers with the brand and support contact; any other
 * text threads into the sender's latest open request in that market, or opens a new intake.
 */
export async function inboundText(p: Record<string, string>) {
  const admin = createAdminSupabase();
  const from = p.From ?? "";
  const to = p.To ?? "";
  const body = (p.Body ?? "").slice(0, 1600);
  const sid = p.MessageSid ?? "";
  if (!E164.test(from) || !/^(SM|MM)[0-9a-fA-F]{32}$/.test(sid)) return;
  const { data: number } = await admin
    .from("market_phone_numbers")
    .select("market_id, purpose")
    .eq("phone_number", to)
    .maybeSingle();
  if (!number) return;

  const keyword = keywordOf(body);
  if (keyword === "stop" || keyword === "start")
    await admin.from("sms_opt_outs").upsert({
      phone: from,
      opted_out: keyword === "stop",
      source: body.trim().toUpperCase().slice(0, 40) || keyword,
      updated_at: new Date().toISOString(),
    });

  // Thread into the latest open request from this number in this market, else start an intake.
  const { data: open } = await admin
    .from("requests")
    .select("id")
    .eq("market_id", number.market_id)
    .eq("driver_phone", from)
    .not("status", "in", "(completed,cancelled,no_provider,expired)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let requestId = open?.id ?? null;
  if (!requestId && !keyword) {
    const { data: code } = await admin.rpc("generate_short_code");
    const { data: created } = await admin
      .from("requests")
      .insert({
        short_code: String(code),
        market_id: number.market_id,
        status: "phone_intake",
        channel: "phone",
        driver_name: getMessages("en").voice.callerName,
        driver_phone: from,
        platform_fee_cents: 0,
        source: number.purpose,
        urgent: true,
      })
      .select("id")
      .single();
    requestId = created?.id ?? null;
  }
  const { error } = await admin.from("sms_messages").insert({
    twilio_sid: sid,
    market_id: number.market_id,
    request_id: requestId,
    direction: "inbound",
    from_phone: from,
    to_phone: to,
    body: body || " ",
    status: "received",
    template_key: keyword,
  });
  // A repeated delivery (same MessageSid) stops here.
  if (error) return;
  if (requestId && !keyword)
    await admin.from("requests").update({ urgent: true }).eq("id", requestId);

  if (keyword === "help") {
    const t = getMessages("en").texts;
    await sendText({
      marketId: number.market_id,
      requestId,
      to: from,
      from: to,
      body: t.help.replace("{brand}", brand.name).replace("{support}", brand.emails.support),
      urgent: true,
      templateKey: "help",
    });
  }
}
