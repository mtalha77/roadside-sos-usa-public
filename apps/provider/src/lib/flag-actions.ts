"use server";

import { z } from "zod";
import { getPortalContext } from "@/lib/portal";
import { getServerSupabase } from "@/lib/supabase/server";

const PROVIDER_FLAG_REASONS = ["fake", "wrong_location", "unreachable", "unsafe", "other"] as const;

const Input = z.object({
  requestId: z.string().min(1).max(80),
  reason: z.enum(PROVIDER_FLAG_REASONS),
  note: z.string().trim().max(500).optional(),
});

/**
 * Flag a request (owner decision 3): fake or prank, wrong location, customer unreachable, unsafe,
 * other, plus an optional note. Real requests (a uuid) are flagged in the database for the admin
 * Inbox; the demo stream's requests are only acknowledged on the page.
 */
export async function flagRequestAction(input: {
  requestId: string;
  reason: string;
  note?: string;
}): Promise<{ ok: boolean }> {
  const p = Input.safeParse(input);
  if (!p.success) return { ok: false };
  const real = z.uuid().safeParse(p.data.requestId);
  if (!real.success) return { ok: true };
  const ctx = await getPortalContext();
  if (!ctx.providerId) return { ok: false };
  const s = await getServerSupabase();
  const { error } = await (
    s.rpc.bind(s) as unknown as (f: string, a: object) => PromiseLike<{ error: unknown }>
  )("flag_request_as_provider", {
    p_provider_id: ctx.providerId,
    p_request_id: real.data,
    p_reason: p.data.reason,
    p_note: p.data.note || null,
  });
  return { ok: !error };
}
