import type { NextRequest } from "next/server";
import { incomingCall } from "@/lib/twilio/calls";
import { firstDelivery, forbidden, readTwilio, xml } from "@/lib/twilio/webhook";

export const dynamic = "force-dynamic";

/** Incoming call to a tracking number (the number's Voice webhook in Twilio). */
export async function POST(request: NextRequest) {
  const tw = await readTwilio(request);
  if (!tw) return forbidden();
  const first = await firstDelivery("twilio", `voice:${tw.params.CallSid ?? ""}`);
  return xml(await incomingCall(tw.params, tw.url, first));
}
