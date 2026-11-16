import { createAdminSupabase } from "@rsos/db/admin";
import type { NextRequest } from "next/server";
import { firstDelivery, forbidden, readTwilio } from "@/lib/twilio/webhook";

export const dynamic = "force-dynamic";

const STATUS: Record<string, "sent" | "delivered" | "undelivered" | "failed" | undefined> = {
  sent: "sent",
  delivered: "delivered",
  undelivered: "undelivered",
  failed: "failed",
};

/** Delivery status for our texts: stored per message with Twilio's error code. */
export async function POST(request: NextRequest) {
  const tw = await readTwilio(request);
  if (!tw) return forbidden();
  const sid = tw.params.MessageSid ?? "";
  const status = STATUS[tw.params.MessageStatus ?? ""];
  if (!/^(SM|MM)[0-9a-fA-F]{32}$/.test(sid) || !status) return new Response(null, { status: 204 });
  if (await firstDelivery("twilio", `sms-status:${sid}:${status}`)) {
    const code = Number(tw.params.ErrorCode);
    await createAdminSupabase()
      .from("sms_messages")
      .update({
        status,
        error_code: Number.isFinite(code) && code > 0 ? code : null,
        status_at: new Date().toISOString(),
      })
      .eq("twilio_sid", sid)
      // Callbacks can arrive out of order: never move a delivered text back.
      .neq("status", "delivered");
  }
  return new Response(null, { status: 204 });
}
