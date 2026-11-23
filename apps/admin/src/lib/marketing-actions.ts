"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type SpendState = { ok?: boolean; error?: "forbidden" | "invalid" | "generic" };

/** Daily ad spend per market and channel (super admins and marketing; RLS enforces it too). */
export async function saveSpendAction(_: SpendState, form: FormData): Promise<SpendState> {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin" && ctx.role !== "marketing") return { error: "forbidden" };
  const parsed = z
    .object({
      day: z.iso.date(),
      market: z.string(),
      channel: z.enum(["google_ads", "meta", "bing", "gmb", "other"]),
      amount: z.coerce.number().min(0).max(1_000_000),
    })
    .safeParse({
      day: form.get("day"),
      market: form.get("market"),
      channel: form.get("channel"),
      amount: form.get("amount"),
    });
  const market = parsed.success ? ctx.markets.find((m) => m.slug === parsed.data.market) : null;
  if (!parsed.success || !market) return { error: "invalid" };
  const { error } = await (await getServerSupabase()).from("ad_spend").upsert({
    day: parsed.data.day,
    market_id: market.id,
    channel: parsed.data.channel,
    amount_cents: Math.round(parsed.data.amount * 100),
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/marketing");
  return error ? { error: "generic" } : { ok: true };
}
