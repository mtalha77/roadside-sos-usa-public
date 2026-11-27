"use server";

import { formatCurrency, formatDateTime, type Locale } from "@rsos/i18n";
import { createAdminSupabase } from "@rsos/db/admin";
import { chooseEmailSender, PlanPriceNoticeEmail, planPriceNoticeSubject } from "@rsos/emails";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { parsePriceChange } from "@/lib/plans";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Admin > Plans & pricing actions (RSOS-114). Each goes through a database function that checks
 * the role and writes the audit log; these validate the form and report on the page.
 */
type RpcError = { message: string; code?: string } | null;
type Rpc = (f: string, a: object) => PromiseLike<{ data: unknown; error: RpcError }>;
const rpc = async () => {
  const s = await getServerSupabase();
  return s.rpc.bind(s) as unknown as Rpc;
};
const usd = (max: number) =>
  z.coerce
    .number()
    .min(0)
    .max(max)
    .transform((d) => Math.round(d * 100));

function outcome(error: RpcError, done: string, anchor: string): never {
  revalidatePath("/plans");
  if (!error) redirect(`/plans?done=${done}#${anchor}`);
  const kind =
    error.code === "42501"
      ? "forbidden"
      : /at least 20/.test(error.message)
        ? "minimum"
        : "invalid";
  redirect(`/plans?error=${kind}#${anchor}`);
}

async function editor() {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin" && ctx.role !== "ops_manager") redirect("/plans?error=forbidden");
  return ctx;
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((s) => s.slice(0, 160));

export async function saveCatalogAction(form: FormData) {
  await editor();
  const p = z
    .object({
      plan: z.enum(["basic", "pro", "featured"]),
      name: z.string().trim().min(2).max(40),
      discount: z.coerce.number().min(0).max(50),
      firstLook: z.coerce.number().int().min(0).max(30),
      techLimit: z.union([z.literal(""), z.coerce.number().int().min(1).max(1000)]),
      insights: z.enum(["basic", "full"]),
      autoTopup: z.boolean(),
      active: z.boolean(),
      order: z.coerce.number().int().min(0).max(100),
    })
    .safeParse({
      plan: form.get("plan"),
      name: form.get("name"),
      discount: form.get("discount"),
      firstLook: form.get("firstLook"),
      techLimit: form.get("techLimit") ?? "",
      insights: form.get("insights"),
      autoTopup: form.get("autoTopup") === "on",
      active: form.get("active") === "on",
      order: form.get("order"),
    });
  if (!p.success) redirect("/plans?error=invalid#catalog");
  const d = p.data;
  const { error } = await (
    await rpc()
  )("set_plan_catalog", {
    p_plan: d.plan,
    p_name: d.name,
    p_fee_discount_bps: Math.round(d.discount * 100),
    p_first_look_seconds: d.firstLook,
    p_technician_limit: d.techLimit === "" ? null : d.techLimit,
    p_insights_level: d.insights,
    p_auto_topup: d.autoTopup,
    p_active: d.active,
    p_sort_order: d.order,
    p_bullets: { en: lines(form.get("bulletsEn")), es: lines(form.get("bulletsEs")) },
  });
  outcome(error, "catalog", "catalog");
}

/** Sets the new price, then emails each affected subscriber's owners the notice. */
export async function setPriceAction(form: FormData) {
  await editor();
  const change = parsePriceChange(Object.fromEntries(form));
  if (!change) redirect("/plans?error=invalid#prices");
  const { data, error } = await (
    await rpc()
  )("set_plan_price", {
    p_plan: change.plan,
    p_market_id: change.market,
    p_price_cents: change.priceCents,
    p_effective_from: change.effectiveFrom,
    p_grandfather: change.grandfather,
    p_notice_days: change.noticeDays,
    p_dry_run: false,
  });
  if (!error && !change.grandfather) await sendNotices(data, change.plan, "en");
  outcome(error, "price", "prices");
}

const Affected = z.array(
  z.object({
    provider_id: z.uuid(),
    provider_name: z.string(),
    current_cents: z.number(),
    new_cents: z.number(),
    applies_from: z.string().nullable(),
  }),
);

/** The notice email to the owners of each affected provider (fake sender outside production). */
async function sendNotices(raw: unknown, plan: string, locale: Locale) {
  const rows = Affected.safeParse(raw);
  if (!rows.success) return;
  const admin = createAdminSupabase();
  const sender = chooseEmailSender();
  for (const r of rows.data) {
    if (!r.applies_from || r.new_cents === r.current_cents) continue;
    const { data: owners } = await admin
      .from("provider_members")
      .select("user_id")
      .eq("provider_id", r.provider_id)
      .eq("role", "owner");
    for (const o of owners ?? []) {
      const { data: user } = await admin.auth.admin.getUserById(o.user_id);
      const email = user.user?.email;
      if (!email) continue;
      const props = {
        company: r.provider_name,
        plan,
        oldPrice: formatCurrency(r.current_cents, locale),
        newPrice: formatCurrency(r.new_cents, locale),
        date: formatDateTime(new Date(r.applies_from), locale, "UTC", { dateStyle: "long" }),
        locale,
      };
      await sender
        .send({
          to: email,
          subject: planPriceNoticeSubject(plan, locale),
          react: PlanPriceNoticeEmail(props),
          tags: { kind: "plan_price_notice" },
        })
        .catch(() => null);
    }
  }
}

export async function saveFeaturedAction(form: FormData) {
  await editor();
  const p = z
    .object({
      market: z.uuid(),
      slots: z.coerce.number().int().min(1).max(20),
      pct: z.coerce.number().int().min(0).max(100),
      eta: z.coerce.number().int().min(0).max(60),
      service: z.boolean(),
    })
    .safeParse({
      market: form.get("market"),
      slots: form.get("slots"),
      pct: form.get("pct"),
      eta: form.get("eta"),
      service: form.get("service") === "on",
    });
  if (!p.success) redirect("/plans?error=invalid#featured");
  const { error } = await (
    await rpc()
  )("set_featured_settings", {
    p_market_id: p.data.market,
    p_slots: p.data.slots,
    p_price_rule_pct: p.data.pct,
    p_eta_rule_minutes: p.data.eta,
    p_service_slots: p.data.service,
  });
  outcome(error, "featured", "featured");
}

export async function saveOfferAction(form: FormData) {
  await editor();
  const p = z
    .object({
      market: z.uuid(),
      plan: z.enum(["basic", "pro"]),
      price: usd(1000),
      ends: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      active: z.boolean(),
    })
    .safeParse({
      market: form.get("market"),
      plan: form.get("plan"),
      price: form.get("price"),
      ends: form.get("ends"),
      active: form.get("active") === "on",
    });
  if (!p.success) redirect("/plans?error=invalid#offers");
  const { error } = await (
    await rpc()
  )("set_plan_offer", {
    p_market_id: p.data.market,
    p_plan: p.data.plan,
    p_first_month_cents: p.data.price,
    p_ends_at: new Date(`${p.data.ends}T23:59:59Z`).toISOString(),
    p_active: p.data.active,
  });
  outcome(error, "offer", "offers");
}

/** Puts a provider on a plan (fake billing): the way to give real providers a plan while
 * provider checkout is off in production. */
export async function assignPlanAction(form: FormData) {
  await editor();
  const p = z
    .object({ provider: z.uuid(), plan: z.enum(["basic", "pro"]) })
    .safeParse({ provider: form.get("provider"), plan: form.get("plan") });
  if (!p.success) redirect("/plans?error=invalid#assign");
  const { error } = await (
    await rpc()
  )("start_plan", { p_provider_id: p.data.provider, p_plan: p.data.plan });
  outcome(error, "assigned", "assign");
}

export async function cancelSubscriptionAction(form: FormData) {
  await editor();
  const id = z.uuid().safeParse(form.get("subscription"));
  if (!id.success) redirect("/plans?error=invalid#subscribers");
  const { error } = await (await rpc())("cancel_plan", { p_subscription_id: id.data });
  outcome(error, "cancelled", "subscribers");
}
