"use server";

import { EconomicsInputs, SCENARIOS } from "@rsos/core/economics";
import type { Json } from "@rsos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type EconomicsState = { ok?: boolean; error?: string };

const num = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[,$%\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const pct = (v: FormDataEntryValue | null) => num(v) / 100;

const Target = z.object({ marketId: z.uuid(), scenario: z.enum(SCENARIOS) });

/**
 * Saves one market's inputs for one scenario (RSOS-113). Owners and operations managers only:
 * checked here and again by RLS; the database writes the history row. Percentages are typed as
 * percentages and stored as shares.
 */
export async function saveEconomicsAction(
  _prev: EconomicsState,
  form: FormData,
): Promise<EconomicsState> {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin" && ctx.role !== "ops_manager") return { error: "forbidden" };
  const target = Target.safeParse({
    marketId: form.get("marketId"),
    scenario: form.get("scenario"),
  });
  if (!target.success) return { error: "invalid" };
  const services = String(form.get("services") ?? "")
    .split(",")
    .filter((s) => /^[a-z0-9-]{1,40}$/.test(s));
  const parsed = EconomicsInputs.safeParse({
    monthlyBudget: num(form.get("monthlyBudget")),
    costPerClick: num(form.get("costPerClick")),
    clickToRequest: pct(form.get("clickToRequest")),
    acceptance: pct(form.get("acceptance")),
    serviceMix: Object.fromEntries(services.map((s) => [s, pct(form.get(`mix.${s}`))])),
    feeByService: Object.fromEntries(services.map((s) => [s, num(form.get(`fee.${s}`))])),
    paymentFeeShare: pct(form.get("paymentFeeShare")),
    subscriptionsNet: num(form.get("subscriptionsNet")),
    fixedCosts: num(form.get("fixedCosts")),
    startToSubmit: pct(form.get("startToSubmit")),
    quoteRate: pct(form.get("quoteRate")),
    completionRate: pct(form.get("completionRate")),
    signupBonus: form.get("signupBonus") ? num(form.get("signupBonus")) : undefined,
    newProvidersPerMonth: form.get("newProviders") ? num(form.get("newProviders")) : undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const mixTotal = Object.values(parsed.data.serviceMix).reduce((a, b) => a + b, 0);
  if (Math.abs(mixTotal - 1) > 0.005) return { error: "mix" };
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("economics_models").upsert(
    {
      market_id: target.data.marketId,
      scenario: target.data.scenario,
      inputs: parsed.data as unknown as Json,
      updated_by: ctx.userId,
    },
    { onConflict: "market_id,scenario" },
  );
  if (error) return { error: "save" };
  revalidatePath("/economics");
  revalidatePath("/analytics");
  return { ok: true };
}
