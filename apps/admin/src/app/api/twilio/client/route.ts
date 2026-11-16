import { hangupTwiml, outboundCallTwiml } from "@rsos/core/adapters";
import { createAdminSupabase } from "@rsos/db/admin";
import type { NextRequest } from "next/server";
import { userIdFromIdentity } from "@/lib/twilio/calls";
import { callbackUrl, forbidden, readTwilio, xml } from "@/lib/twilio/webhook";

export const dynamic = "force-dynamic";

const E164 = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * TwiML App voice URL (RSOS-074b): a dispatcher calls a driver or provider from the browser. The
 * caller ID is the market's tracking number, the call is logged and appears on the request timeline.
 */
export async function POST(request: NextRequest) {
  const tw = await readTwilio(request);
  if (!tw) return forbidden();
  const p = tw.params;
  const userId = userIdFromIdentity(p.From ?? "");
  const to = p.To ?? "";
  if (!userId || !E164.test(to) || !/^CA[0-9a-fA-F]{32}$/.test(p.CallSid ?? ""))
    return xml(hangupTwiml());
  const admin = createAdminSupabase();
  const { data: staff } = await admin
    .from("staff_members")
    .select("role, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (!staff?.is_active || !["super_admin", "ops_manager", "dispatcher"].includes(staff.role))
    return xml(hangupTwiml());

  // The market comes from the linked request, else the one the dock chose.
  const requestId = UUID.test(p.RequestId ?? "") ? p.RequestId! : null;
  let marketId = UUID.test(p.MarketId ?? "") ? p.MarketId! : null;
  if (requestId) {
    const { data: req } = await admin
      .from("requests")
      .select("market_id")
      .eq("id", requestId)
      .maybeSingle();
    marketId = req?.market_id ?? marketId;
  }
  if (!marketId) return xml(hangupTwiml());
  const { data: callerId } = await admin.rpc("market_phone_for_source", {
    p_market_id: marketId,
    p_source: "website",
  });
  if (typeof callerId !== "string" || !E164.test(callerId)) return xml(hangupTwiml());

  await admin.from("calls").insert({
    twilio_call_sid: p.CallSid!,
    market_id: marketId,
    direction: "outbound",
    from_phone: callerId,
    to_phone: to,
    request_id: requestId,
    staff_user_id: userId,
    outcome: "ringing",
  });
  if (requestId)
    await admin.from("request_events").insert({
      request_id: requestId,
      event_type: "call_outbound",
      actor_type: "staff",
      actor_id: userId,
      data: { to_last4: to.slice(-4) },
    });
  return xml(
    outboundCallTwiml({
      to,
      callerId,
      statusCallback: callbackUrl(tw.url, "/api/twilio/voice/status"),
    }),
  );
}
