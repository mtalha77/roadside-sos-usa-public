import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { appUrl } from "@rsos/config/site";
import {
  type CallFlowText,
  fallbackCallTwiml,
  hangupTwiml,
  incomingCallTwiml,
  nextLeg,
  voicemailTwiml,
} from "@rsos/core/adapters";
import { createAdminSupabase } from "@rsos/db/admin";
import { getMessages } from "@rsos/i18n";
import { DispatchAlertEmail, chooseEmailSender, dispatchAlertSubject } from "@rsos/emails";
import { brand } from "@rsos/config/brand";
import { callbackUrl } from "./webhook";

const E164 = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
/** "{brand}" in a spoken message, filled from config. */
const withBrand = (s: string) => s.replaceAll("{brand}", brand.name);
const SID = /^CA[0-9a-fA-F]{32}$/;

/** Browser softphone identity for a dispatcher (Twilio identities: letters, digits, underscore). */
export const clientIdentity = (userId: string) => `u_${userId.replace(/-/g, "_")}`;
export const userIdFromIdentity = (identity: string) =>
  /^client:u_[0-9a-f_]{36}$/.test(identity)
    ? identity.slice("client:u_".length).replace(/_/g, "-")
    : null;

function flowText(): CallFlowText {
  const v = getMessages("en").voice;
  return {
    greeting: withBrand(v.greeting),
    safety: v.safety,
    recordingNotice: v.recordingNotice,
    voicemail: v.voicemail,
    goodbye: v.goodbye,
  };
}

async function onDuty() {
  const { data } = await createAdminSupabase().rpc("on_duty_dispatchers", {});
  return data ?? [];
}

/**
 * Incoming call: find the dialed tracking number (market and source), create the call and a
 * phone-intake request (once per CallSid), and ring every available dispatcher's browser.
 */
export async function incomingCall(params: Record<string, string>, url: URL, first: boolean) {
  const admin = createAdminSupabase();
  const sid = params.CallSid ?? "";
  const to = params.To ?? "";
  const from = params.From ?? "";
  if (!SID.test(sid)) return hangupTwiml();
  const { data: number } = await admin
    .from("market_phone_numbers")
    .select("id, market_id, purpose, phone_number, markets(call_recording_enabled)")
    .eq("phone_number", to)
    .eq("is_active", true)
    .maybeSingle();
  if (!number) return hangupTwiml();
  const record = Boolean(
    (number.markets as { call_recording_enabled?: boolean } | null)?.call_recording_enabled,
  );

  if (first) {
    let requestId: string | null = null;
    if (E164.test(from)) {
      const { data: code } = await admin.rpc("generate_short_code");
      const { data: req } = await admin
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
        })
        .select("id")
        .single();
      requestId = req?.id ?? null;
    }
    await admin.from("calls").insert({
      twilio_call_sid: sid,
      market_id: number.market_id,
      tracking_number_id: number.id,
      direction: "inbound",
      source: number.purpose,
      from_phone: from.slice(0, 80) || "unknown",
      to_phone: to,
      request_id: requestId,
    });
    if (requestId)
      await admin.from("request_events").insert({
        request_id: requestId,
        event_type: "call_received",
        data: { source: number.purpose },
      });
  }

  const clients = (await onDuty())
    .filter((d) => d.presence === "available")
    .map((d) => clientIdentity(d.user_id));
  return incomingCallTwiml({
    text: flowText(),
    record,
    clients,
    action: callbackUrl(url, "/api/twilio/voice/dial"),
    recordingStatusCallback: callbackUrl(url, "/api/twilio/voice/recording", { kind: "call" }),
  });
}

/** After each Dial: answered ends the flow; otherwise mobiles, then voicemail. */
export async function dialResult(params: Record<string, string>, url: URL) {
  const admin = createAdminSupabase();
  const leg = url.searchParams.get("leg") === "numbers" ? "numbers" : "clients";
  const sid = params.CallSid ?? "";
  const status = params.DialCallStatus ?? null;
  const next = nextLeg(leg, url.searchParams.get("none") ? null : status);
  if (next === "done") {
    await admin
      .from("calls")
      .update({ outcome: "answered", answered_at: new Date().toISOString() })
      .eq("twilio_call_sid", sid)
      .eq("outcome", "ringing");
    return hangupTwiml();
  }
  if (next === "numbers") {
    const numbers = (await onDuty())
      .map((d) => d.mobile_phone)
      .filter((n): n is string => typeof n === "string" && E164.test(n));
    const { data: call } = await admin
      .from("calls")
      .select("to_phone, markets(call_recording_enabled)")
      .eq("twilio_call_sid", sid)
      .maybeSingle();
    return fallbackCallTwiml({
      numbers,
      callerId: call?.to_phone ?? params.To ?? "",
      action: callbackUrl(url, "/api/twilio/voice/dial"),
      record: Boolean(
        (call?.markets as { call_recording_enabled?: boolean } | null)?.call_recording_enabled,
      ),
      recordingStatusCallback: callbackUrl(url, "/api/twilio/voice/recording", { kind: "call" }),
    });
  }
  return voicemailTwiml({
    text: flowText(),
    recordingStatusCallback: callbackUrl(url, "/api/twilio/voice/recording", {
      kind: "voicemail",
    }),
    transcribeCallback: callbackUrl(url, "/api/twilio/voice/transcription"),
  });
}

/** Call status callback: duration and end; an unanswered call without voicemail is "missed". */
export async function callStatus(params: Record<string, string>, url: URL) {
  const admin = createAdminSupabase();
  const sid = params.CallSid ?? "";
  if (!SID.test(sid)) return;
  const final = ["completed", "no-answer", "busy", "failed", "canceled"].includes(
    params.CallStatus ?? "",
  );
  if (!final) return;
  const duration = Number(params.CallDuration);
  const { data: call } = await admin
    .from("calls")
    .update({
      ended_at: new Date().toISOString(),
      duration_sec: Number.isFinite(duration) ? duration : null,
    })
    .eq("twilio_call_sid", sid)
    .select("id, outcome, request_id, market_id, from_phone, to_phone, direction")
    .maybeSingle();
  if (!call) return;
  if (call.direction === "outbound") {
    // Outbound (RSOS-074b): record how the dispatcher's call ended.
    const outcome =
      params.CallStatus === "completed"
        ? ("completed" as const)
        : params.CallStatus === "busy"
          ? ("busy" as const)
          : params.CallStatus === "no-answer" || params.CallStatus === "canceled"
            ? ("missed" as const)
            : ("failed" as const);
    await admin.from("calls").update({ outcome }).eq("id", call.id);
    return;
  }
  if (call.outcome !== "ringing") return;
  await admin.from("calls").update({ outcome: "missed" }).eq("id", call.id);
  await urgentFollowUp(call, "missed", url);
}

/** Recording callback: voicemails become urgent inbox items; call recordings are just stored. */
export async function recordingDone(params: Record<string, string>, url: URL) {
  const admin = createAdminSupabase();
  const sid = params.CallSid ?? "";
  const rec = params.RecordingSid ?? "";
  if (!SID.test(sid) || !/^RE[0-9a-fA-F]{32}$/.test(rec)) return;
  const kind = url.searchParams.get("kind") === "voicemail" ? "voicemail" : "call";
  const duration = Number(params.RecordingDuration);
  const { data: call } = await admin
    .from("calls")
    .update({
      recording_sid: rec,
      recording_duration_sec: Number.isFinite(duration) ? duration : null,
      ...(kind === "voicemail" ? { outcome: "voicemail" as const } : {}),
    })
    .eq("twilio_call_sid", sid)
    .select("id, request_id, market_id, from_phone, to_phone, direction")
    .maybeSingle();
  if (call && kind === "voicemail") {
    await urgentFollowUp(call, "voicemail", url);
  }
}

export async function transcription(params: Record<string, string>) {
  const sid = params.CallSid ?? "";
  if (!SID.test(sid) || !params.TranscriptionText) return;
  await createAdminSupabase()
    .from("calls")
    .update({ voicemail_transcript: params.TranscriptionText.slice(0, 4000) })
    .eq("twilio_call_sid", sid);
}

/** Missed call or voicemail: mark the request urgent and text the on-duty dispatchers. */
async function urgentFollowUp(
  call: { request_id: string | null; market_id: string; from_phone: string; to_phone: string },
  kind: "missed" | "voicemail",
  url: URL,
) {
  const admin = createAdminSupabase();
  if (call.request_id) {
    await admin.from("requests").update({ urgent: true }).eq("id", call.request_id);
    await admin.from("request_events").insert({
      request_id: call.request_id,
      event_type: kind === "missed" ? "call_missed" : "voicemail",
      data: {},
    });
  }
  // Email the on-duty dispatchers (texts are off in this batch).
  const admin2 = createAdminSupabase();
  const [{ data: market }, onDutyNow] = await Promise.all([
    admin2.from("markets").select("name").eq("id", call.market_id).maybeSingle(),
    onDuty(),
  ]);
  const emails = (
    await Promise.all(
      onDutyNow.map(async (d) => (await admin2.auth.admin.getUserById(d.user_id)).data.user?.email),
    )
  ).filter((e): e is string => Boolean(e));
  const alert = {
    kind,
    caller: call.from_phone,
    market: market?.name ?? "",
    inboxUrl: callbackUrl(url, "/inbox").replace(/\?.*$/, ""),
  } as const;
  const sender = chooseEmailSender();
  for (const to of [...new Set(emails)])
    await sender
      .send({
        to,
        subject: dispatchAlertSubject(alert),
        react: DispatchAlertEmail(alert),
        tags: { category: `dispatch_${kind}` },
      })
      .catch(() => null);
}

/**
 * A short, unguessable location link for a request (RSOS-023): 2 hours, one request, with a
 * 6-digit code the dispatcher can read on the call (the driver types it at /l on the website).
 */
export async function createLocationLink(
  requestId: string,
): Promise<{ url: string; code: string; codeUrl: string } | null> {
  const admin = createAdminSupabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = randomBytes(18).toString("base64url");
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const { error } = await admin
      .from("location_links")
      .insert({ token, request_id: requestId, code });
    if (!error) return { url: `${appUrl("web")}/l/${token}`, code, codeUrl: `${appUrl("web")}/l` };
    if (error.code !== "23505") return null;
  }
  return null;
}
