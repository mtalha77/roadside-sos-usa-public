"use server";

import { GRANT_REASONS } from "@rsos/core/wallet";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Wallet credits actions (RSOS-115). Every one goes through a database function that checks the
 * role's approval limit and writes the ledger and the audit log; these only validate the form and
 * report the outcome on the page (`?done=` or `?error=`).
 */
type Rpc = (
  f: string,
  a: object,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
const rpc = async () => {
  const s = await getServerSupabase();
  return s.rpc.bind(s) as unknown as Rpc;
};
const cents = z.coerce
  .number()
  .min(1)
  .max(1000)
  .transform((d) => Math.round(d * 100));
const days = z.coerce.number().int().min(1).max(365);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

function outcome(
  error: { message: string; code?: string } | null,
  done: string,
  anchor: string,
): never {
  revalidatePath("/credits");
  if (!error) redirect(`/credits?done=${done}#${anchor}`);
  const kind = /limit|owner/.test(error.message)
    ? "limit"
    : error.code === "42501"
      ? "forbidden"
      : "invalid";
  redirect(`/credits?error=${kind}#${anchor}`);
}

async function staff(allowed: string[]) {
  const ctx = await getAdminContext();
  if (!allowed.includes(ctx.role)) redirect("/credits?error=forbidden");
  return ctx;
}

export async function setSignupBonusAction(form: FormData) {
  await staff(["super_admin", "ops_manager"]);
  const p = z
    .object({
      market: z.uuid(),
      enabled: z.boolean(),
      amount: cents,
      expiry: days,
      starts: date,
      ends: date,
    })
    .safeParse({
      market: form.get("market"),
      enabled: form.get("enabled") === "on",
      amount: form.get("amount"),
      expiry: form.get("expiry"),
      starts: form.get("starts") || null,
      ends: form.get("ends") || null,
    });
  if (!p.success) redirect("/credits?error=invalid#signup");
  const { error } = await (
    await rpc()
  )("set_signup_bonus", {
    p_market_id: p.data.market,
    p_enabled: p.data.enabled,
    p_amount_cents: p.data.amount,
    p_expiry_days: p.data.expiry,
    p_starts_on: p.data.starts,
    p_ends_on: p.data.ends,
  });
  outcome(error, "signup", "signup");
}

export async function grantCreditAction(form: FormData) {
  await staff(["super_admin", "ops_manager"]);
  const p = z
    .object({
      provider: z.uuid(),
      amount: cents,
      expiry: days,
      reason: z.enum(GRANT_REASONS),
      note: z.string().trim().max(300).optional(),
    })
    .refine((x) => x.reason !== "other" || (x.note ?? "").length >= 3)
    .safeParse({
      provider: form.get("provider"),
      amount: form.get("amount"),
      expiry: form.get("expiry"),
      reason: form.get("reason"),
      note: form.get("note") || undefined,
    });
  if (!p.success) redirect("/credits?error=invalid#grant");
  const { error } = await (
    await rpc()
  )("grant_bonus_credit", {
    p_provider_id: p.data.provider,
    p_amount_cents: p.data.amount,
    p_expiry_days: p.data.expiry,
    p_reason: p.data.reason,
    p_note: p.data.note ?? null,
  });
  outcome(error, "grant", "grant");
}

const CampaignForm = z.object({
  name: z.string().trim().min(3).max(80),
  market: z.uuid(),
  audience: z.enum(["market", "service", "inactive", "list"]),
  service: z.uuid().optional(),
  list: z.array(z.uuid()).max(500).optional(),
  amount: cents,
  expiry: days,
  message: z.string().trim().max(300).optional(),
  budget: z.coerce
    .number()
    .min(1)
    .max(100_000)
    .transform((d) => Math.round(d * 100)),
  plan: z.boolean(),
});

export async function runCampaignAction(form: FormData) {
  await staff(["super_admin", "ops_manager"]);
  const p = CampaignForm.safeParse({
    name: form.get("name"),
    market: form.get("market"),
    audience: form.get("audience"),
    service: form.get("service") || undefined,
    list: form.getAll("list").map(String).filter(Boolean),
    amount: form.get("amount"),
    expiry: form.get("expiry"),
    message: form.get("message") || undefined,
    budget: form.get("budget"),
    plan: form.get("plan") === "on",
  });
  if (!p.success) redirect("/credits?error=invalid#campaign");
  const d = p.data;
  const { error } = await (
    await rpc()
  )("run_credit_campaign", {
    p_name: d.name,
    p_market_id: d.market,
    p_service_id: d.audience === "service" ? (d.service ?? null) : null,
    p_inactive_days: d.audience === "inactive" ? 30 : null,
    p_provider_ids: d.audience === "list" ? (d.list ?? []) : null,
    p_amount_cents: d.amount,
    p_expiry_days: d.expiry,
    p_message: d.message ?? null,
    p_budget_cents: d.budget,
    p_plan_allowed: d.plan,
  });
  outcome(error, "campaign", "campaign");
}

export async function setRuleAction(form: FormData) {
  await staff(["super_admin", "ops_manager"]);
  const p = z
    .object({
      market: z.uuid(),
      kind: z.enum(["milestone", "referral", "reactivation"]),
      enabled: z.boolean(),
      amount: cents,
      expiry: days,
      threshold: z.coerce.number().int().min(1).max(1000),
      budget: z.coerce
        .number()
        .min(0)
        .max(100_000)
        .transform((d) => Math.round(d * 100)),
    })
    .safeParse({
      market: form.get("market"),
      kind: form.get("kind"),
      enabled: form.get("enabled") === "on",
      amount: form.get("amount"),
      expiry: form.get("expiry"),
      threshold: form.get("threshold") || 10,
      budget: form.get("budget"),
    });
  if (!p.success) redirect("/credits?error=invalid#rules");
  const d = p.data;
  const { error } = await (
    await rpc()
  )("set_credit_rule", {
    p_market_id: d.market,
    p_kind: d.kind,
    p_enabled: d.enabled,
    p_amount_cents: d.amount,
    p_expiry_days: d.expiry,
    p_threshold: d.threshold,
    p_budget_cents: d.budget,
  });
  outcome(error, "rule", "rules");
}

export async function setLimitAction(form: FormData) {
  await staff(["super_admin"]);
  const usd = z
    .union([z.literal(""), z.coerce.number().min(0).max(1_000_000)])
    .transform((v) => (v === "" ? null : Math.round(v * 100)));
  const p = z.object({ role: z.enum(["ops_manager"]), grant: usd, campaign: usd }).safeParse({
    role: form.get("role"),
    grant: form.get("grant"),
    campaign: form.get("campaign"),
  });
  if (!p.success) redirect("/credits?error=invalid#limits");
  const { error } = await (
    await rpc()
  )("set_credit_limit", {
    p_role: p.data.role,
    p_per_grant_cents: p.data.grant,
    p_per_campaign_cents: p.data.campaign,
  });
  outcome(error, "limit", "limits");
}

export async function reverseCreditAction(form: FormData) {
  await staff(["super_admin"]);
  const p = z
    .object({ grant: z.uuid(), reason: z.string().trim().min(3).max(300) })
    .safeParse({ grant: form.get("grant"), reason: form.get("reason") });
  if (!p.success) redirect("/credits?error=invalid#grants");
  const { error } = await (
    await rpc()
  )("reverse_bonus_credit", { p_grant_id: p.data.grant, p_reason: p.data.reason });
  outcome(error, "reverse", "grants");
}

export async function reviewFlagAction(form: FormData) {
  await staff(["super_admin", "ops_manager"]);
  const p = z
    .object({ flag: z.uuid(), grant: z.enum(["yes", "no"]) })
    .safeParse({ flag: form.get("flag"), grant: form.get("grant") });
  if (!p.success) redirect("/credits?error=invalid#flags");
  const { error } = await (
    await rpc()
  )("clear_review_flag", { p_flag_id: p.data.flag, p_grant: p.data.grant === "yes" });
  outcome(error, "flag", "flags");
}
