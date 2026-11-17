import { after, type NextRequest } from "next/server";
import { transcription } from "@/lib/twilio/calls";
import { firstDelivery, forbidden, readTwilio } from "@/lib/twilio/webhook";

export const dynamic = "force-dynamic";

/** Voicemail transcription: stored on the call for the inbox. */
export async function POST(request: NextRequest) {
  const tw = await readTwilio(request);
  if (!tw) return forbidden();
  const key = `transcription:${tw.params.TranscriptionSid ?? tw.params.CallSid ?? ""}`;
  if (await firstDelivery("twilio", key)) after(() => transcription(tw.params));
  return new Response(null, { status: 204 });
}
