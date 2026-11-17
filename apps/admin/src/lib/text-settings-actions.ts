"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type TextSettingsState = { ok?: boolean; error?: "forbidden" | "invalid" | "generic" };

/** Edits one SMS template (super admins, ops managers and marketing; RLS enforces it too). */
export async function saveTemplateAction(
  _: TextSettingsState,
  form: FormData,
): Promise<TextSettingsState> {
  const ctx = await getAdminContext();
  if (!["super_admin", "ops_manager", "marketing"].includes(ctx.role))
    return { error: "forbidden" };
  const parsed = z
    .object({
      key: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
      en: z.string().trim().min(2).max(640),
      es: z.string().trim().min(2).max(640),
    })
    .safeParse({ key: form.get("key"), en: form.get("en"), es: form.get("es") });
  if (!parsed.success) return { error: "invalid" };
  const { error } = await (
    await getServerSupabase()
  )
    .from("sms_templates")
    .update({
      body_en: parsed.data.en,
      body_es: parsed.data.es,
      updated_at: new Date().toISOString(),
    })
    .eq("key", parsed.data.key);
  revalidatePath("/settings");
  return error ? { error: "generic" } : { ok: true };
}

/** A2P 10DLC status and the owner's override (super admins only). */
export async function setA2pAction(form: FormData): Promise<void> {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin") return;
  const parsed = z
    .object({ status: z.enum(["pending", "approved", "rejected"]), override: z.boolean() })
    .safeParse({ status: form.get("status"), override: form.get("override") === "on" });
  if (!parsed.success) return;
  await (
    await getServerSupabase()
  )
    .from("system_settings")
    .update({ value: parsed.data, updated_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("key", "a2p_10dlc");
  revalidatePath("/", "layout");
}
