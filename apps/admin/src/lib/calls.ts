import "server-only";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

export const CALL_OUTCOMES = [
  "ringing",
  "answered",
  "missed",
  "voicemail",
  "busy",
  "failed",
  "completed",
] as const;
export const OutcomeFilter = z.enum(CALL_OUTCOMES).optional().catch(undefined);

export type CallRow = {
  id: string;
  at: number;
  market: string;
  direction: "inbound" | "outbound";
  outcome: (typeof CALL_OUTCOMES)[number];
  from: string;
  to: string;
  durationSec: number | null;
  requestId: string | null;
  requestCode: string | null;
  voicemail: boolean;
};

/**
 * The call log (RSOS-103): every call in the markets in view over the last 7 days, newest first
 * (RLS: staff read calls in their markets). Recordings stay behind the authenticated proxy.
 */
export async function listCalls(
  markets: { id: string; name: string }[],
  outcome?: (typeof CALL_OUTCOMES)[number],
): Promise<CallRow[]> {
  if (!markets.length) return [];
  const supabase = await getServerSupabase();
  let q = supabase
    .from("calls")
    .select(
      "id, created_at, market_id, direction, outcome, from_phone, to_phone, duration_sec, request_id, voicemail_transcript, recording_sid, requests(short_code)",
    )
    .in(
      "market_id",
      markets.map((m) => m.id),
    )
    .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  if (outcome) q = q.eq("outcome", outcome);
  const { data } = await q;
  const name = new Map(markets.map((m) => [m.id, m.name]));
  return (data ?? []).map((c) => {
    const req = c.requests as { short_code?: string } | null;
    return {
      id: c.id,
      at: Date.parse(c.created_at),
      market: name.get(c.market_id) ?? "",
      direction: c.direction,
      outcome: c.outcome,
      from: c.from_phone,
      to: c.to_phone,
      durationSec: c.duration_sec,
      requestId: c.request_id,
      requestCode: req?.short_code ?? null,
      voicemail: Boolean(c.voicemail_transcript || (c.outcome === "voicemail" && c.recording_sid)),
    };
  });
}
