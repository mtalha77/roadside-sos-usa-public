"use server";

import { createPublicSupabase } from "@rsos/db/public";
import { cookies } from "next/headers";
import { z } from "zod";
import { BROWSER_ID_COOKIE, COOKIE_POLICY_VERSION } from "./consent";

const Choice = z.object({ analytics: z.boolean(), ads: z.boolean(), gpc: z.boolean() });

/** Stores the cookie choice with the cookie policy version shown (no personal data). */
export async function recordConsentAction(input: z.infer<typeof Choice>): Promise<void> {
  const parsed = Choice.safeParse(input);
  if (!parsed.success) return;
  const store = await cookies();
  let id = store.get(BROWSER_ID_COOKIE)?.value;
  if (!id || !z.uuid().safeParse(id).success) {
    id = crypto.randomUUID();
    store.set(BROWSER_ID_COOKIE, id, {
      path: "/",
      maxAge: 365 * 24 * 3600,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }
  const supabase = createPublicSupabase();
  if (!supabase) return;
  await supabase.rpc(
    "record_cookie_consent" as never,
    {
      p: {
        browser_id: id,
        ...parsed.data,
        ads: parsed.data.ads && !parsed.data.gpc,
        policy_version: COOKIE_POLICY_VERSION,
      },
    } as never,
  );
}
