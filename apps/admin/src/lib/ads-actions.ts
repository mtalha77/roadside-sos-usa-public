"use server";

import { AD_PLATFORMS, chooseAds } from "@rsos/core/ads";
import { createAdminSupabase } from "@rsos/db/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Admin > Marketing > Connections actions (RSOS-107). Switches and mappings go through database
 * functions (role checks and the audit log); "Test connection" calls the platform with the keys in
 * the server environment and stores only the account name or the error, never a key.
 */
type Rpc = (f: string, a: object) => PromiseLike<{ error: { message: string } | null }>;
const rpc = async () => {
  const s = await getServerSupabase();
  return s.rpc.bind(s) as unknown as Rpc;
};
const done = (error: unknown, what: string, anchor: string): never => {
  revalidatePath("/marketing/connections");
  redirect(`/marketing/connections?${error ? "error" : "done"}=${what}#${anchor}`);
};
const Platform = z.enum(AD_PLATFORMS);

async function marketing() {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin" && ctx.role !== "marketing")
    redirect("/marketing/connections?error=forbidden");
  return ctx;
}

export async function setConnectionAction(form: FormData) {
  await marketing();
  const p = z
    .object({ platform: Platform, enabled: z.enum(["on", "off"]) })
    .safeParse({ platform: form.get("platform"), enabled: form.get("enabled") });
  if (!p.success) redirect("/marketing/connections?error=invalid");
  const { error } = await (
    await rpc()
  )("set_ad_connection", { p_platform: p.data.platform, p_enabled: p.data.enabled === "on" });
  done(error, "switch", p.data.platform);
}

export async function testConnectionAction(form: FormData) {
  await marketing();
  const p = Platform.safeParse(form.get("platform"));
  if (!p.success) redirect("/marketing/connections?error=invalid");
  // The keys exist only on the server; the switch does not matter for a test.
  const adapter = chooseAds(p.data, true);
  if (!adapter) redirect(`/marketing/connections?test=missing#${p.data}`);
  const res = await adapter.testConnection();
  await createAdminSupabase()
    .from("ad_connections")
    .update(
      res.ok
        ? { account_name: res.accountName.slice(0, 120), last_error: null }
        : { last_error: res.error.slice(0, 300) },
    )
    .eq("platform", p.data);
  revalidatePath("/marketing/connections");
  redirect(`/marketing/connections?test=${res.ok ? "ok" : "failed"}#${p.data}`);
}

export async function mapCampaignAction(form: FormData) {
  await marketing();
  const p = z
    .object({
      platform: Platform,
      campaign: z.string().min(1).max(64),
      market: z.union([z.literal(""), z.uuid()]),
      service: z.union([z.literal(""), z.string().regex(/^[a-z-]{2,40}$/)]),
    })
    .safeParse({
      platform: form.get("platform"),
      campaign: form.get("campaign"),
      market: form.get("market") ?? "",
      service: form.get("service") ?? "",
    });
  if (!p.success) redirect("/marketing/connections?error=invalid#campaigns");
  const { error } = await (
    await rpc()
  )("map_ad_campaign", {
    p_platform: p.data.platform,
    p_campaign_id: p.data.campaign,
    p_market_id: p.data.market || null,
    p_service: p.data.service || null,
  });
  done(error, "mapping", "campaigns");
}

export async function setAdCodeAction(form: FormData) {
  await marketing();
  const p = z
    .object({
      market: z.uuid(),
      code: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9]{0,6}$/),
    })
    .safeParse({ market: form.get("market"), code: form.get("code") ?? "" });
  if (!p.success) redirect("/marketing/connections?error=invalid#codes");
  const { error } = await (
    await rpc()
  )("set_market_ad_code", { p_market_id: p.data.market, p_code: p.data.code });
  done(error, "code", "codes");
}

export async function setPauseRuleAction(form: FormData) {
  const ctx = await getAdminContext();
  if (!["super_admin", "ops_manager", "marketing"].includes(ctx.role))
    redirect("/marketing/connections?error=forbidden#pause");
  const p = z
    .object({
      market: z.uuid(),
      enabled: z.boolean(),
      min: z.coerce.number().int().min(1).max(50),
      grace: z.coerce.number().int().min(0).max(240),
      start: z.coerce.number().int().min(0).max(23),
      end: z.coerce.number().int().min(1).max(24),
    })
    .safeParse({
      market: form.get("market"),
      enabled: form.get("enabled") === "on",
      min: form.get("min"),
      grace: form.get("grace"),
      start: form.get("start"),
      end: form.get("end"),
    });
  if (!p.success) redirect("/marketing/connections?error=invalid#pause");
  const d = p.data;
  const { error } = await (
    await rpc()
  )("set_ad_pause_rule", {
    p_market_id: d.market,
    p_enabled: d.enabled,
    p_min_providers: d.min,
    p_grace_minutes: d.grace,
    p_start_hour: d.start,
    p_end_hour: d.end,
  });
  done(error, "rule", "pause");
}
