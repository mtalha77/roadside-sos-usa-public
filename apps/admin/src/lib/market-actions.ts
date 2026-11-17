"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type MarketStatusState = {
  ok?: boolean;
  error?: "forbidden" | "invalid" | "checklist" | "generic";
};

/**
 * Changes a market's status (RSOS-089-prep). Going live needs a green launch checklist, or a super
 * admin's override with a reason; the database enforces both and logs every change.
 */
export async function setMarketStatusAction(
  _: MarketStatusState,
  form: FormData,
): Promise<MarketStatusState> {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin" && ctx.role !== "ops_manager") return { error: "forbidden" };
  const parsed = z
    .object({
      market: z.uuid(),
      status: z.enum(["draft", "test", "active", "paused"]),
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse({
      market: form.get("market"),
      status: form.get("status"),
      reason: form.get("reason") || undefined,
    });
  if (!parsed.success) return { error: "invalid" };
  const { error } = await (
    await getServerSupabase()
  ).rpc("set_market_status", {
    p_market_id: parsed.data.market,
    p_status: parsed.data.status,
    p_override_reason: parsed.data.reason,
  });
  revalidatePath("/markets", "layout");
  if (error) return { error: error.message.includes("checklist") ? "checklist" : "generic" };
  return { ok: true };
}
