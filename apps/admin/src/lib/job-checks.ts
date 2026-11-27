import "server-only";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

const FlagRow = z.object({
  id: z.string(),
  kind: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
  booking_id: z.string(),
  provider_id: z.string(),
  provider_name: z.string(),
  market_id: z.string(),
  short_code: z.string(),
});
const SpotRow = z.object({
  booking_id: z.string(),
  week: z.string(),
  market_id: z.string(),
  short_code: z.string(),
  provider_name: z.string(),
  done_at: z.string().nullable(),
});
type Rpc = (f: string, a: object) => PromiseLike<{ data: unknown }>;

/**
 * Inbox > Job checks (RSOS-117): automatic warning flags on jobs (with held fees waiting for a
 * decision, the no-shows over the monthly limit) and the weekly spot checks ("Confirm with
 * customer"). Staff see their own markets (RLS); rows are parsed, not cast.
 */
export async function getJobChecks(marketIds: string[], providerId?: string) {
  const supabase = await getServerSupabase();
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const [flags, spot] = await Promise.all([
    rpc("job_check_flags", { p_provider_id: providerId ?? null }),
    providerId ? Promise.resolve({ data: [] }) : rpc("job_spot_checks", {}),
  ]);
  const inView = (m: string) => marketIds.includes(m);
  return {
    flags: z
      .array(FlagRow)
      .catch([])
      .parse(flags.data ?? [])
      .filter((f) => inView(f.market_id))
      .map((f) => ({
        id: f.id,
        kind: f.kind,
        note: f.note,
        createdAt: f.created_at,
        bookingId: f.booking_id,
        providerId: f.provider_id,
        provider: f.provider_name,
        code: f.short_code,
      })),
    spotChecks: z
      .array(SpotRow)
      .catch([])
      .parse(spot.data ?? [])
      .filter((s) => inView(s.market_id))
      .map((s) => ({
        bookingId: s.booking_id,
        week: s.week,
        code: s.short_code,
        provider: s.provider_name,
        doneAt: s.done_at,
      })),
  };
}
