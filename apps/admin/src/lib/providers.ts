import "server-only";
import { demoMarkets } from "@rsos/config/demo-fixtures";
import { demoProviders, rng, seedFrom } from "@rsos/core/demo";
import type { ProviderLogoData } from "@rsos/ui/provider-logo";
import { getServerSupabase } from "@/lib/supabase/server";

export type ProviderRow = {
  id: string;
  name: string;
  status: string;
  markets: string[];
  demo: boolean;
  trucks: number | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
  area: string | null;
  logo: ProviderLogoData | null;
};
export type DocItem = {
  kind: "insurance" | "license" | "w9";
  expires: number;
  state: "pending" | "ok" | "expiring";
};

/** Real providers (staff can read all) plus the demo directory, filtered by market and search. */
export async function listProviders(opts: {
  markets: string[];
  marketIds: Record<string, string>;
  q: string;
  demo: boolean;
}) {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("providers")
    .select("id, name, status, market_ids, is_demo")
    .order("name");
  const slugOf = Object.fromEntries(Object.entries(opts.marketIds).map(([slug, id]) => [id, slug]));
  const real: ProviderRow[] = (data ?? [])
    .filter((p) => !p.is_demo)
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      markets: p.market_ids.map((id) => slugOf[id] ?? "").filter(Boolean),
      demo: false,
      trucks: null,
      rating: null,
      lat: null,
      lng: null,
      area: null,
      logo: null,
    }));
  const demo: ProviderRow[] = opts.demo
    ? opts.markets.flatMap((m) =>
        demoProviders(m).map((p) => ({
          id: `demo-${m}-${p.slug}`,
          name: p.name,
          status: rng(seedFrom(p.slug))() > 0.85 ? "onboarding" : "active",
          markets: [m],
          demo: true,
          trucks: p.trucks,
          rating: p.rating,
          lat: p.home.lat,
          lng: p.home.lng,
          area: p.area,
          logo: p.logo,
        })),
      )
    : [];
  const q = opts.q.trim().toLowerCase();
  return [...real, ...demo]
    .filter((p) => p.markets.some((m) => opts.markets.includes(m)) || p.markets.length === 0)
    .filter((p) => !q || p.name.toLowerCase().includes(q));
}

/** Demo documents for a provider (fictional; the review queue shows them side by side). */
export function demoDocuments(id: string, now: number): DocItem[] {
  const r = rng(seedFrom(id));
  const day = 86_400_000;
  return (["insurance", "license", "w9"] as const).map((kind) => {
    const expires = now + Math.round((r() * 400 - 20) * day);
    const state = expires < now + 30 * day ? "expiring" : r() > 0.7 ? "pending" : "ok";
    return { kind, expires, state };
  });
}

export const isDemoProviderId = (id: string) => id.startsWith("demo-");
export function demoProviderFromId(id: string) {
  if (!id.startsWith("demo-")) return null;
  for (const market of Object.keys(demoMarkets)) {
    if (!id.startsWith(`demo-${market}-`)) continue;
    const slug = id.slice(`demo-${market}-`.length);
    const p = demoProviders(market).find((x) => x.slug === slug);
    if (p) return p;
  }
  return null;
}
