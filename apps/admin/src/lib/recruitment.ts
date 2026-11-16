import "server-only";
import { demoMarkets, demoPeople } from "@rsos/config/demo-fixtures";
import { rng, seedFrom } from "@rsos/core/demo";
import { getServerSupabase } from "@/lib/supabase/server";

export const STAGES = ["lead", "contacted", "interested", "onboarding", "live", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export type Lead = {
  id: string;
  company: string;
  contact: string;
  phone: string;
  market: string;
  stage: Stage;
  trucks: number | null;
  source: string;
  createdAt: number;
  demo: boolean;
  task: string | null;
};

const FROM_APP: Record<string, Stage> = {
  new: "lead",
  reviewing: "interested",
  approved: "onboarding",
  rejected: "lost",
};

/** Real applications from the For Providers form, plus demo leads in demo mode. */
export async function listLeads(opts: {
  markets: string[];
  marketIds: Record<string, string>;
  demo: boolean;
  now: number;
}) {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("provider_applications")
    .select(
      "id, company_name, contact_name, phone, market_ids, status, truck_count, referral_source, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  const slugOf = Object.fromEntries(Object.entries(opts.marketIds).map(([s, id]) => [id, s]));
  const real: Lead[] = (data ?? []).map((a) => ({
    id: a.id,
    company: a.company_name,
    contact: a.contact_name,
    phone: a.phone,
    market: slugOf[a.market_ids[0] ?? ""] ?? "",
    stage: FROM_APP[a.status] ?? "lead",
    trucks: a.truck_count,
    source: a.referral_source ?? "website",
    createdAt: Date.parse(a.created_at),
    demo: false,
    task: null,
  }));
  const demo: Lead[] = opts.demo
    ? opts.markets
        .filter((m) => demoMarkets[m])
        .flatMap((m) =>
          Array.from({ length: 14 }, (_, i) => {
            const r = rng(seedFrom(`${m}-lead-${i}`));
            const first = demoPeople.first[Math.floor(r() * demoPeople.first.length)]!;
            const area = demoMarkets[m]!.areas[Math.floor(r() * demoMarkets[m]!.areas.length)]!;
            const stage = STAGES[Math.min(5, Math.floor(r() * 6))]!;
            return {
              id: `demo-lead-${m}-${i}`,
              company: `${area.name} Towing ${i + 1} (demo)`,
              contact: first,
              phone: `+1${demoMarkets[m]!.areaCode}55501${String(10 + i).slice(-2)}`,
              market: m,
              stage,
              trucks: 1 + Math.floor(r() * 6),
              source: ["google", "referral", "cold call", "facebook"][Math.floor(r() * 4)]!,
              createdAt: opts.now - Math.floor(r() * 30) * 86_400_000,
              demo: true,
              task: stage === "contacted" || stage === "interested" ? "follow_up" : null,
            } satisfies Lead;
          }),
        )
    : [];
  return [...real.filter((l) => !l.market || opts.markets.includes(l.market)), ...demo];
}
