"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

type Rpc = (f: string, a: object) => PromiseLike<{ error: { code?: string } | null }>;

/** Clear a warning flag; for a no-show in review, release or charge the held fee. */
export async function clearFlagAction(form: FormData) {
  const p = z
    .object({
      id: z.uuid(),
      note: z.string().trim().max(500),
      decision: z.enum(["none", "release", "charge"]),
    })
    .safeParse({
      id: form.get("id"),
      note: form.get("note") ?? "",
      decision: form.get("decision") ?? "none",
    });
  if (!p.success) redirect("/inbox/checks?error=invalid");
  const s = await getServerSupabase();
  const { error } = await (s.rpc.bind(s) as unknown as Rpc)("clear_booking_flag", {
    p_flag_id: p.data.id,
    p_note: p.data.note || null,
    p_release: p.data.decision === "none" ? null : p.data.decision === "release",
  });
  revalidatePath("/inbox/checks");
  redirect(error ? "/inbox/checks?error=forbidden" : "/inbox/checks?done=flag");
}

/** Mark a spot check: the customer confirmed the job, or there was a problem. */
export async function spotCheckAction(form: FormData) {
  const p = z
    .object({ booking: z.uuid(), ok: z.enum(["yes", "no"]), note: z.string().trim().max(500) })
    .safeParse({ booking: form.get("booking"), ok: form.get("ok"), note: form.get("note") ?? "" });
  if (!p.success) redirect("/inbox/checks?error=invalid");
  const s = await getServerSupabase();
  const { error } = await (s.rpc.bind(s) as unknown as Rpc)("resolve_spot_check", {
    p_booking_id: p.data.booking,
    p_ok: p.data.ok === "yes",
    p_note: p.data.note || null,
  });
  revalidatePath("/inbox/checks");
  redirect(error ? "/inbox/checks?error=forbidden" : "/inbox/checks?done=spot");
}
