import { after, type NextRequest } from "next/server";
import { callStatus } from "@/lib/twilio/calls";
import { firstDelivery, forbidden, readTwilio } from "@/lib/twilio/webhook";

export const dynamic = "force-dynamic";

/** Call status callback: idempotent, answers at once, does the work after the response. */
export async function POST(request: NextRequest) {
  const tw = await readTwilio(request);
  if (!tw) return forbidden();
  const key = `status:${tw.params.CallSid ?? ""}:${tw.params.CallStatus ?? ""}`;
  if (await firstDelivery("twilio", key)) after(() => callStatus(tw.params, tw.url));
  return new Response(null, { status: 204 });
}
