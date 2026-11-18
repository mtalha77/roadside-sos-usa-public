import "server-only";
import { isDemoMode } from "@rsos/config/demo";
import { parseClaims } from "@rsos/db/claims";
import { cookies } from "next/headers";
import { getServerSupabase } from "@/lib/supabase/server";

export type AdminMarket = {
  id: string;
  slug: string;
  name: string;
  status: string;
  timeZone: string;
  stateCode: string;
};

/** Signed-in staff member, real markets and the market filter chosen in the switcher. */
export async function getAdminContext() {
  const supabase = await getServerSupabase();
  const [{ data: claimsData }, { data: rows }, jar] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("markets").select("id, slug, name, status, time_zone, state_code").order("name"),
    cookies(),
  ]);
  const claims = parseClaims(claimsData?.claims);
  const markets: AdminMarket[] = (rows ?? []).map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    status: m.status,
    timeZone: m.time_zone,
    stateCode: m.state_code,
  }));
  const chosen = (jar.get("rsos_markets")?.value ?? "")
    .split(",")
    .filter((s) => markets.some((m) => m.slug === s));
  return {
    email: claims?.email ?? "",
    userId: claims?.sub ?? "",
    role: claims?.staff_role ?? "",
    /** No market limit on this staff member (all markets). */
    allMarkets: !claims?.staff_markets,
    markets,
    selected: chosen.length ? chosen : markets.map((m) => m.slug),
    demo: isDemoMode(),
  };
}
export type AdminContext = Awaited<ReturnType<typeof getAdminContext>>;
