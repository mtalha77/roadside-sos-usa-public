import { after, type NextRequest } from "next/server";
import { recordingDone } from "@/lib/twilio/calls";
import { firstDelivery, forbidden, readTwilio } from "@/lib/twilio/webhook";

export const dynamic = "force-dynamic";

/** Recording callback (call recordings and voicemails): idempotent, work after the response. */
export async function POST(request: NextRequest) {
  const tw = await readTwilio(request);
  if (!tw) return forbidden();
  if (await firstDelivery("twilio", `recording:${tw.params.RecordingSid ?? ""}`))
    after(() => recordingDone(tw.params, tw.url));
  return new Response(null, { status: 204 });
}
