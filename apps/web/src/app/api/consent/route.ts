import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BROWSER_ID_COOKIE,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  type ConsentChoice,
  COOKIE_POLICY_VERSION,
} from "@/lib/consent";
import { safeReturn } from "@/lib/return-path";

const Form = z.object({
  choice: z.enum(["accept", "reject", "save"]),
  analytics: z.boolean(),
  ads: z.boolean(),
  return: z.string(),
});

/**
 * Saves cookie choices from the banner or the privacy choices page (plain form posts: no JavaScript
 * needed). A Global Privacy Control signal (`Sec-GPC: 1`) always turns advertising off. The choice is
 * stored with the cookie policy version, then the visitor goes back to the page they were on.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const parsed = Form.safeParse({
    choice: form.get("choice"),
    analytics: form.get("analytics") === "on",
    ads: form.get("ads") === "on",
    return: String(form.get("return") ?? "/"),
  });
  const back = new URL(safeReturn(parsed.success ? parsed.data.return : "/"), request.url);
  if (!parsed.success) return NextResponse.redirect(back, 303);
  const gpc = request.headers.get("sec-gpc") === "1";
  const { choice } = parsed.data;
  const a = choice === "accept" ? true : choice === "reject" ? false : parsed.data.analytics;
  const d = (choice === "accept" ? true : choice === "reject" ? false : parsed.data.ads) && !gpc;
  const value: ConsentChoice = { v: COOKIE_POLICY_VERSION, a, d, gpc };

  const res = NextResponse.redirect(back, 303);
  const secure = request.nextUrl.protocol === "https:";
  // Readable by the head script, which applies it to Consent Mode before any tag could load.
  // Next encodes cookie values once; the head script and the server decode once.
  res.cookies.set(CONSENT_COOKIE, JSON.stringify(value), {
    path: "/",
    maxAge: CONSENT_MAX_AGE,
    sameSite: "lax",
    secure,
  });
  let id = request.cookies.get(BROWSER_ID_COOKIE)?.value;
  if (!id || !z.uuid().safeParse(id).success) {
    id = crypto.randomUUID();
    res.cookies.set(BROWSER_ID_COOKIE, id, {
      path: "/",
      maxAge: CONSENT_MAX_AGE,
      sameSite: "lax",
      secure,
      httpOnly: true,
    });
  }
  const supabase = createPublicSupabase();
  if (supabase) {
    await supabase.rpc(
      "record_cookie_consent" as never,
      {
        p: { browser_id: id, analytics: a, ads: d, gpc, policy_version: COOKIE_POLICY_VERSION },
      } as never,
    );
  }
  return res;
}
