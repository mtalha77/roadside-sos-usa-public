import type { NextRequest } from "next/server";
import { dialResult } from "@/lib/twilio/calls";
import { forbidden, readTwilio, xml } from "@/lib/twilio/webhook";

export const dynamic = "force-dynamic";

/** Result of each Dial leg (browsers, then mobiles): the next leg or the end of the call. */
export async function POST(request: NextRequest) {
  const tw = await readTwilio(request);
  if (!tw) return forbidden();
  return xml(await dialResult(tw.params, tw.url));
}
