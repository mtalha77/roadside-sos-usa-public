import { textingEnabled } from "@rsos/core/adapters";
import { after, type NextRequest, NextResponse } from "next/server";
import { inboundText } from "@/lib/twilio/inbound-sms";
import { forbidden, readTwilio, xml } from "@/lib/twilio/webhook";

export const dynamic = "force-dynamic";

/**
 * Incoming texts (the Messaging Service's webhook). Answers at once with empty TwiML; the work
 * (opt-outs, threading, HELP reply) runs after the response. MessageSid is unique in the database,
 * so repeated deliveries are ignored.
 */
export async function POST(request: NextRequest) {
  // Texting is off (owner scope change, batch 4): nothing is read or stored.
  if (!textingEnabled()) return new NextResponse(null, { status: 404 });
  const tw = await readTwilio(request);
  if (!tw) return forbidden();
  after(() => inboundText(tw.params));
  return xml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
}
