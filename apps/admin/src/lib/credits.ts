import "server-only";
import { z } from "zod";
import type { AdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

type Rpc = (f: string, a?: object) => PromiseLike<{ data: unknown; error: unknown }>;

const Recipient = z.object({
  provider_id: z.uuid(),
  name: z.string(),
  market_id: z.uuid().nullable(),
});
const Report = z.object({
  campaign_id: z.uuid(),
  name: z.string(),
  market_id: z.uuid().nullable(),
  created_at: z.string(),
  granted_cents: z.coerce.number(),
  used_cents: z.coerce.number(),
  expired_cents: z.coerce.number(),
  recipients: z.number(),
  topped_up: z.number(),
  jobs_on_credit: z.number(),
  revenue_60d_cents: z.coerce.number(),
});
const Outstanding = z.object({
  market_id: z.uuid().nullable(),
  outstanding_cents: z.coerce.number().nullable(),
  providers: z.number(),
  used_cents: z.coerce.number(),
  expired_cents: z.coerce.number(),
});

/** Everything Admin > Business > Wallet credits shows (RSOS-115). RLS and definer checks apply. */
export async function getCredits(ctx: AdminContext) {
  const supabase = await getServerSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const ids = ctx.markets.filter((m) => ctx.selected.includes(m.slug)).map((m) => m.id);
  const [rules, creditRules, limits, providers, services, grants, flags, report] =
    await Promise.all([
      supabase.from("signup_bonus_rules").select("*"),
      supabase.from("credit_rules").select("*"),
      supabase.from("credit_limits").select("*"),
      supabase
        .from("providers")
        .select("id, name, market_ids, status")
        .eq("status", "active")
        .eq("is_demo", false)
        .order("name")
        .limit(500),
      supabase.from("services").select("id, slug, name").order("sort_order"),
      supabase
        .from("bonus_grants")
        .select(
          "id, provider_id, market_id, source, reason, note, amount_cents, remaining_cents, expires_at, created_at, reversed_at, campaign_id",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("provider_review_flags")
        .select("id, provider_id, kind, data, status, created_at")
        .eq("status", "open")
        .order("created_at"),
      rpc("credit_campaign_report"),
    ]);
  const names = new Map((providers.data ?? []).map((p) => [p.id, p.name]));
  const missing = [
    ...new Set(
      [
        ...(grants.data ?? []).map((g) => g.provider_id),
        ...(flags.data ?? []).map((f) => f.provider_id),
      ].filter((id) => !names.has(id)),
    ),
  ];
  if (missing.length) {
    const { data } = await supabase.from("providers").select("id, name").in("id", missing);
    for (const p of data ?? []) names.set(p.id, p.name);
  }
  return {
    rules: new Map((rules.data ?? []).map((r) => [r.market_id, r])),
    creditRules: creditRules.data ?? [],
    limits: limits.data ?? [],
    providers: (providers.data ?? []).filter((p) => p.market_ids.some((m) => ids.includes(m))),
    services: services.data ?? [],
    grants: grants.data ?? [],
    flags: flags.data ?? [],
    report: z
      .array(Report)
      .catch([])
      .parse(report.data ?? []),
    name: (id: string) => names.get(id) ?? id.slice(0, 8),
  };
}

/** A campaign's recipients before confirming (the database function applies the same filters). */
export async function previewCampaign(q: {
  market: string;
  audience: "market" | "service" | "inactive" | "list";
  service?: string;
  list?: string[];
}) {
  const supabase = await getServerSupabase();
  const { data } = await (supabase.rpc.bind(supabase) as unknown as Rpc)(
    "credit_campaign_recipients",
    {
      p_market_id: q.market,
      p_service_id: q.audience === "service" ? (q.service ?? null) : null,
      p_inactive_days: q.audience === "inactive" ? 30 : null,
      p_provider_ids: q.audience === "list" ? (q.list ?? []) : null,
    },
  );
  return z
    .array(Recipient)
    .catch([])
    .parse(data ?? []);
}

/** Finance: outstanding bonus credit per market (a liability), plus used and expired totals. */
export async function getOutstandingCredit() {
  const supabase = await getServerSupabase();
  const { data } = await (supabase.rpc.bind(supabase) as unknown as Rpc)(
    "outstanding_bonus_credit",
  );
  return z
    .array(Outstanding)
    .catch([])
    .parse(data ?? []);
}
