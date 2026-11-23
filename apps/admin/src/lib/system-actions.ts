"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

/** Super admins change the daily usage alert thresholds (RLS enforces the role too). */
export async function updateThresholdAction(form: FormData): Promise<void> {
  const parsed = z
    .object({
      group: z.enum(["maps", "twilio"]),
      units: z.coerce.number().int().min(1).max(1_000_000),
    })
    .safeParse({ group: form.get("group"), units: form.get("units") });
  if (!parsed.success) return;
  const supabase = await getServerSupabase();
  await supabase
    .from("usage_thresholds")
    .update({ daily_units: parsed.data.units, updated_at: new Date().toISOString() })
    .eq("vendor_group", parsed.data.group);
  revalidatePath("/settings");
}
