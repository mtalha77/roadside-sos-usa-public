"use server";

import { featureOn } from "@rsos/config/features";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getPortalContext } from "@/lib/portal";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Plan & billing actions (RSOS-114). The database checks that the member is the company's owner
 * or dispatcher and records the (fake) charge; checkout itself is behind the planCheckout flag.
 */
async function guard(anchor: string) {
  if (!featureOn("planCheckout")) redirect(`/plan?error=closed#${anchor}`);
  const ctx = await getPortalContext();
  if (!ctx.providerId || ctx.role === "operator") redirect(`/plan?error=forbidden#${anchor}`);
  return { ctx, supabase: await getServerSupabase() };
}

function done(
  error: { code?: string; message: string } | null,
  what: string,
  anchor: string,
): never {
  revalidatePath("/plan");
  if (!error) redirect(`/plan?done=${what}#${anchor}`);
  redirect(`/plan?error=${error.code === "42501" ? "forbidden" : "invalid"}#${anchor}`);
}

export async function startPlanAction(form: FormData) {
  const { ctx, supabase } = await guard("plans");
  const plan = z.enum(["basic", "pro"]).safeParse(form.get("plan"));
  if (!plan.success) redirect("/plan?error=invalid#plans");
  const { error } = await supabase.rpc("start_plan", {
    p_provider_id: ctx.providerId!,
    p_plan: plan.data,
  });
  done(error, plan.data, "plans");
}

export async function cancelPlanAction(form: FormData) {
  const { supabase } = await guard("current");
  const id = z.uuid().safeParse(form.get("subscription"));
  if (!id.success) redirect("/plan?error=invalid#current");
  const { error } = await supabase.rpc("cancel_plan", { p_subscription_id: id.data });
  done(error, "cancelled", "current");
}

export async function joinFeaturedAction(form: FormData) {
  const { ctx, supabase } = await guard("featured");
  const market = z.uuid().safeParse(form.get("market"));
  if (!market.success) redirect("/plan?error=invalid#featured");
  const { data, error } = await supabase.rpc("join_featured", {
    p_provider_id: ctx.providerId!,
    p_market_id: market.data,
  });
  done(error, data === "waitlist" ? "waitlist" : "featured", "featured");
}
