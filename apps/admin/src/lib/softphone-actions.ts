"use server";

import {
  holdTwiml,
  ringClientTwiml,
  softphoneConfig,
  updateLiveCall,
  voiceAccessToken,
} from "@rsos/core/adapters";
import { createAdminSupabase } from "@rsos/db/admin";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { clientIdentity } from "@/lib/twilio/calls";

const DISPATCH_ROLES = new Set(["super_admin", "ops_manager", "dispatcher"]);
const CallSid = z.string().regex(/^CA[0-9a-fA-F]{32}$/);
/** Twilio's hold music (public domain, hosted by Twilio). */
const HOLD_MUSIC = "https://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.mp3";

async function dispatcher() {
  const ctx = await getAdminContext();
  return DISPATCH_ROLES.has(ctx.role) && ctx.userId ? ctx : null;
}

export type SoftphoneToken =
  | { mode: "real"; token: string; identity: string; expiresAt: number }
  | { mode: "fake"; identity: string }
  | { mode: "forbidden" };

/**
 * Access token for the browser softphone (RSOS-074b): 1 hour, identity = this dispatcher; only
 * for dispatchers, ops managers and super admins. Without Twilio keys the dock runs in demo mode.
 */
export async function softphoneTokenAction(): Promise<SoftphoneToken> {
  const ctx = await dispatcher();
  if (!ctx) return { mode: "forbidden" };
  const identity = clientIdentity(ctx.userId);
  const cfg = softphoneConfig();
  if (cfg.mode === "fake") return { mode: "fake", identity };
  const ttl = 3600;
  return {
    mode: "real",
    identity,
    expiresAt: Date.now() + ttl * 1000,
    token: voiceAccessToken({ ...cfg, identity, ttlSec: ttl }),
  };
}

/** Presence: Available (gets rung), Busy (on a call), Away. */
export async function setPresenceAction(presence: "available" | "busy" | "away"): Promise<void> {
  const ctx = await dispatcher();
  const p = z.enum(["available", "busy", "away"]).safeParse(presence);
  if (!ctx || !p.success) return;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("dispatcher_status")
    .select("on_duty_now")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  await supabase.from("dispatcher_status").upsert({
    user_id: ctx.userId,
    presence: p.data,
    on_duty_now: data?.on_duty_now ?? false,
    updated_at: new Date().toISOString(),
  });
}

export type CallInfo = {
  from: string;
  market: string | null;
  source: string | null;
  requestId: string | null;
  requestCode: string | null;
};

/** Screen pop for a ringing call: caller, market, source and any linked request (RLS applies). */
export async function callInfoAction(callSid: string): Promise<CallInfo | null> {
  if (!(await dispatcher()) || !CallSid.safeParse(callSid).success) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("calls")
    .select("from_phone, source, request_id, markets(name), requests(short_code)")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  if (!data) return null;
  const market = data.markets as { name?: string } | null;
  const request = data.requests as { short_code?: string } | null;
  return {
    from: data.from_phone,
    market: market?.name ?? null,
    source: data.source,
    requestId: data.request_id,
    requestCode: request?.short_code ?? null,
  };
}

/** The dispatcher answered in the browser: record who, put them on Busy, log it on the request. */
export async function answeredAction(callSid: string): Promise<void> {
  const ctx = await dispatcher();
  if (!ctx || !CallSid.safeParse(callSid).success) return;
  const admin = createAdminSupabase();
  const { data: call } = await admin
    .from("calls")
    .update({
      staff_user_id: ctx.userId,
      outcome: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("twilio_call_sid", callSid)
    .select("request_id")
    .maybeSingle();
  if (call?.request_id)
    await admin.from("request_events").insert({
      request_id: call.request_id,
      event_type: "call_answered",
      actor_type: "staff",
      actor_id: ctx.userId,
      data: {},
    });
  await setPresenceAction("busy");
}

function twilioCreds() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  return accountSid && authToken ? { accountSid, authToken } : null;
}

/** Hold parks the caller on music; resume rings this dispatcher's browser again. */
export async function holdAction(callSid: string, hold: boolean): Promise<boolean> {
  const ctx = await dispatcher();
  const creds = twilioCreds();
  if (!ctx || !CallSid.safeParse(callSid).success) return false;
  if (!creds) return true; // Demo mode: nothing to move.
  return updateLiveCall(
    creds,
    callSid,
    hold ? holdTwiml(HOLD_MUSIC) : ringClientTwiml(clientIdentity(ctx.userId)),
  );
}

/** Available dispatchers to transfer to (not yourself). */
export async function transferTargetsAction(): Promise<{ userId: string; name: string }[]> {
  const ctx = await dispatcher();
  if (!ctx) return [];
  const supabase = await getServerSupabase();
  const [{ data: on }, { data: staff }] = await Promise.all([
    supabase.rpc("on_duty_dispatchers", {}),
    supabase.from("staff_members").select("user_id, display_name"),
  ]);
  return (on ?? [])
    .filter((d) => d.presence === "available" && d.user_id !== ctx.userId)
    .map((d) => ({
      userId: d.user_id,
      name: (staff ?? []).find((s) => s.user_id === d.user_id)?.display_name ?? "",
    }));
}

/** Transfer: the caller is moved to ring another available dispatcher's browser. */
export async function transferAction(callSid: string, toUserId: string): Promise<boolean> {
  const ctx = await dispatcher();
  const to = z.uuid().safeParse(toUserId);
  if (!ctx || !CallSid.safeParse(callSid).success || !to.success) return false;
  const targets = await transferTargetsAction();
  if (!targets.some((t) => t.userId === to.data)) return false;
  const admin = createAdminSupabase();
  const { data: call } = await admin
    .from("calls")
    .update({ staff_user_id: to.data })
    .eq("twilio_call_sid", callSid)
    .select("request_id")
    .maybeSingle();
  if (call?.request_id)
    await admin.from("request_events").insert({
      request_id: call.request_id,
      event_type: "call_transferred",
      actor_type: "staff",
      actor_id: ctx.userId,
      data: { to: to.data },
    });
  await setPresenceAction("available");
  const creds = twilioCreds();
  return creds ? updateLiveCall(creds, callSid, ringClientTwiml(clientIdentity(to.data))) : true;
}
