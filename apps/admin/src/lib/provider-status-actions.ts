"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Approves (verified, active) or pauses a real provider (RSOS-115). Approval is what grants the
 * market's signup bonus (a database trigger), once per business.
 */
export async function setProviderStatusAction(form: FormData) {
  const ctx = await getAdminContext();
  const p = z
    .object({
      provider: z.uuid(),
      status: z.enum(["active", "paused"]),
      reason: z.string().trim().max(300).optional(),
    })
    .safeParse({
      provider: form.get("provider"),
      status: form.get("status"),
      reason: form.get("reason") || undefined,
    });
  if (!p.success || (ctx.role !== "super_admin" && ctx.role !== "ops_manager"))
    redirect(`/providers/${String(form.get("provider") ?? "")}?error=1`);
  const supabase = await getServerSupabase();
  const { error } = await (
    supabase.rpc as unknown as (
      f: string,
      x: object,
    ) => PromiseLike<{ error: { message: string } | null }>
  )("set_provider_status", {
    p_provider_id: p.data.provider,
    p_status: p.data.status,
    p_reason: p.data.reason ?? null,
  });
  revalidatePath(`/providers/${p.data.provider}`);
  redirect(`/providers/${p.data.provider}?${error ? "error=1" : `done=${p.data.status}`}`);
}
