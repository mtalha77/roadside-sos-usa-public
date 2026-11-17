"use server";

import { listTwilioNumbers } from "@rsos/core/adapters";
import { TRACKING_SOURCES } from "@rsos/core/adapters";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type PhoneActionState = {
  ok?: string;
  error?: "forbidden" | "invalid" | "exists" | "generic" | "noTwilio";
};

const toE164 = (raw: unknown) => {
  const d = String(raw ?? "")
    .replace(/\D/g, "")
    .replace(/^1(?=\d{10}$)/, "");
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? `+1${d}` : null;
};

/** Super admins and ops managers manage tracking numbers (RLS enforces it as well). */
async function manager() {
  const ctx = await getAdminContext();
  return ctx.role === "super_admin" || ctx.role === "ops_manager" ? ctx : null;
}

export async function addNumberAction(
  _: PhoneActionState,
  form: FormData,
): Promise<PhoneActionState> {
  const ctx = await manager();
  if (!ctx) return { error: "forbidden" };
  const parsed = z
    .object({
      phone: z.string(),
      market: z.string(),
      source: z.enum(TRACKING_SOURCES),
      label: z.string().max(80),
    })
    .safeParse({
      phone: toE164(form.get("phone")),
      market: form.get("market"),
      source: form.get("source"),
      label: String(form.get("label") ?? "").trim(),
    });
  if (!parsed.success) return { error: "invalid" };
  const market = ctx.markets.find((m) => m.slug === parsed.data.market);
  if (!market) return { error: "invalid" };
  const { error } = await (await getServerSupabase()).from("market_phone_numbers").insert({
    phone_number: parsed.data.phone,
    market_id: market.id,
    purpose: parsed.data.source,
    label: parsed.data.label || null,
  });
  if (error) return { error: error.code === "23505" ? "exists" : "generic" };
  revalidatePath("/settings");
  return { ok: parsed.data.phone };
}

export async function setNumberActiveAction(form: FormData): Promise<void> {
  if (!(await manager())) return;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await (
    await getServerSupabase()
  )
    .from("market_phone_numbers")
    .update({ is_active: form.get("active") === "true" })
    .eq("id", id.data);
  revalidatePath("/settings");
}

/** Reads the Twilio account's numbers and stamps the ones we track (never changes Twilio). */
export async function syncNumbersAction(_: PhoneActionState): Promise<PhoneActionState> {
  if (!(await manager())) return { error: "forbidden" };
  const numbers = await listTwilioNumbers();
  if (!numbers) return { error: "noTwilio" };
  const supabase = await getServerSupabase();
  for (const n of numbers)
    await supabase
      .from("market_phone_numbers")
      .update({ twilio_sid: n.sid, synced_at: new Date().toISOString() })
      .eq("phone_number", n.phone);
  revalidatePath("/settings");
  return { ok: String(numbers.length) };
}
