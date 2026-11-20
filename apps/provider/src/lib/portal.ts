import "server-only";
import { isDemoMode } from "@rsos/config/demo";
import { demoMarkets } from "@rsos/config/demo-fixtures";
import { demoPortal } from "@rsos/core/demo";
import { createPublicSupabase } from "@rsos/db/public";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

const StatusRow = z.object({
  provider_id: z.string(),
  name: z.string(),
  status: z.string(),
  status_reason: z.string().nullable(),
  role: z.enum(["owner", "manager", "operator"]),
});

/** The signed-in member's company and role (real, from the database). */
export async function getPortalContext() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc("my_provider_status");
  const row = StatusRow.safeParse(Array.isArray(data) ? data[0] : null).data ?? null;
  const company = row?.name ?? "";
  // The demo company's market comes from the fixtures; real companies use their first market.
  const marketSlug =
    Object.entries(demoMarkets).find(([, m]) => m.providers.some((p) => p.name === company))?.[0] ??
    "san-antonio";
  const fixture = demoMarkets[marketSlug]?.providers.find((p) => p.name === company);
  const providerSlug = fixture?.slug;
  return {
    company,
    /** Demo companies only: the monogram logo drivers see on quotes. */
    companyLogo: fixture?.logo ?? null,
    role: row?.role ?? "operator",
    status: row?.status ?? "active",
    providerId: row?.provider_id ?? null,
    marketSlug,
    providerSlug,
    demo: isDemoMode(),
    canSeeMoney: row?.role !== "operator",
  };
}
export type PortalContext = Awaited<ReturnType<typeof getPortalContext>>;

type Svc = {
  service_slug: string;
  service_name: string;
  enabled: boolean;
  price_min_cents: number | null;
  price_max_cents: number | null;
  platform_fee_cents: number | null;
};

/** Real prices and fees for the market (public function), used for quotes and fees everywhere. */
export async function getMarketPricing(marketSlug: string): Promise<Svc[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];
  const { data } = await (
    supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>
  )("get_market_services", { p_market_slug: marketSlug });
  return (Array.isArray(data) ? data : []) as Svc[];
}

/** Demo portal data for this company, priced with the market's real ranges and fees. */
export async function getPortalData(ctx: PortalContext, now: number) {
  const pricing = await getMarketPricing(ctx.marketSlug);
  const ranges = Object.fromEntries(
    pricing
      .filter((p) => p.price_min_cents !== null)
      .map((p) => [p.service_slug, { min: p.price_min_cents!, max: p.price_max_cents! }]),
  );
  const fees = Object.fromEntries(
    pricing
      .filter((p) => p.platform_fee_cents !== null)
      .map((p) => [p.service_slug, p.platform_fee_cents!]),
  );
  return {
    pricing,
    data: demoPortal(now, {
      marketSlug: ctx.marketSlug,
      providerSlug: ctx.providerSlug,
      ranges,
      fees,
    }),
  };
}

/** Real wallet balance (provider_wallets, owner and manager only by RLS). */
export async function getWalletBalance(providerId: string | null): Promise<number | null> {
  if (!providerId) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("provider_wallets")
    .select("balance_cents")
    .eq("provider_id", providerId)
    .maybeSingle();
  return data?.balance_cents ?? null;
}

const Summary = z.object({
  paid_cents: z.number(),
  bonus_cents: z.number(),
  next_expiry: z.string().nullable(),
  next_expiry_cents: z.number().nullable(),
});
export type WalletLine = {
  id: string;
  at: number;
  kind: string;
  balance: "paid" | "bonus";
  amountCents: number;
  requestId: string | null;
};

/**
 * Both balances (RSOS-115): paid balance and bonus credit (spent first, expires), the ledger and
 * the latest welcome notice. Owners and managers only (RLS and the summary function check it).
 * In demo mode a company with no grants shows a labelled demo grant so the screen can be seen.
 */
export async function getWallet(providerId: string | null, demo: boolean, now: number) {
  const empty = {
    paidCents: 0,
    bonusCents: 0,
    nextExpiry: null as { at: number; cents: number } | null,
  };
  if (!providerId) return { ...empty, lines: [] as WalletLine[], welcome: null, demoCredit: false };
  const supabase = await getServerSupabase();
  const [summary, ledger, notice] = await Promise.all([
    (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>)(
      "wallet_summary",
      {
        p_provider_id: providerId,
      },
    ),
    supabase
      .from("wallet_ledger")
      .select("id, created_at, kind, balance, amount_cents, request_id")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("provider_notices")
      .select("kind, data, created_at")
      .eq("provider_id", providerId)
      .eq("kind", "bonus_welcome")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const row = z
    .array(Summary)
    .catch([])
    .parse(summary.data ?? [])[0];
  const lines: WalletLine[] = (ledger.data ?? []).map((l) => ({
    id: String(l.id),
    at: Date.parse(l.created_at),
    kind: l.kind,
    balance: l.balance === "bonus" ? "bonus" : "paid",
    amountCents: l.amount_cents,
    requestId: l.request_id,
  }));
  const welcome = z
    .object({ amount_cents: z.number(), expires_at: z.string() })
    .safeParse(notice.data?.data);
  if (demo && !lines.some((l) => l.balance === "bonus")) {
    const at = now - 3 * 86_400_000;
    return {
      paidCents: row?.paid_cents ?? 0,
      bonusCents: 5000,
      nextExpiry: { at: at + 60 * 86_400_000, cents: 5000 },
      lines: [
        {
          id: "demo-bonus",
          at,
          kind: "bonus_grant",
          balance: "bonus" as const,
          amountCents: 5000,
          requestId: null,
        },
        ...lines,
      ],
      welcome: null,
      demoCredit: true,
    };
  }
  return {
    paidCents: row?.paid_cents ?? 0,
    bonusCents: row?.bonus_cents ?? 0,
    nextExpiry:
      row?.next_expiry && row.next_expiry_cents
        ? { at: Date.parse(row.next_expiry), cents: row.next_expiry_cents }
        : null,
    lines,
    welcome: welcome.success
      ? { cents: welcome.data.amount_cents, expiresAt: Date.parse(welcome.data.expires_at) }
      : null,
    demoCredit: false,
  };
}

/** The company's own prices per service (its price table), in cents; empty when it has none. */
export async function getPriceTable(providerId: string | null): Promise<Record<string, number>> {
  if (!providerId) return {};
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("provider_service_prices")
    .select("price_cents, active, services(slug)")
    .eq("provider_id", providerId)
    .eq("active", true);
  return Object.fromEntries(
    (data ?? []).flatMap((r) => {
      const slug = (r.services as { slug?: string } | null)?.slug;
      return slug ? [[slug, r.price_cents]] : [];
    }),
  );
}
