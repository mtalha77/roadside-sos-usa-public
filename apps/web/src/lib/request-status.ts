import "server-only";
import { createPublicSupabase } from "@rsos/db/public";
import { z } from "zod";

export const RealRequestSchema = z.object({
  short_code: z.string(),
  status: z.enum([
    "draft",
    "submitted",
    "quoting",
    "quoted",
    "accepted",
    "en_route",
    "on_site",
    "completed",
    "cancelled",
    "expired",
  ]),
  service_slug: z.string(),
  service_name: z.string(),
  market_slug: z.string(),
  market_name: z.string(),
  market_time_zone: z.string(),
  created_at: z.string(),
  submitted_at: z.string().nullable(),
  accepted_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
});
export type RealRequest = z.infer<typeof RealRequestSchema>;

type Rpc = (f: string, a: object) => PromiseLike<{ data: unknown; error: unknown }>;

/** A real request by its status token (only what the driver may see), or null. */
export async function getRealRequest(token: string): Promise<RealRequest | null> {
  const supabase = createPublicSupabase();
  if (!supabase || token.length < 24) return null;
  const { data } = await (supabase.rpc as unknown as Rpc)("get_request_by_token", {
    p_token: token,
  });
  const row = Array.isArray(data) ? data[0] : null;
  return row ? (RealRequestSchema.safeParse(row).data ?? null) : null;
}

export async function cancelRealRequest(token: string, reason: string): Promise<boolean> {
  const supabase = createPublicSupabase();
  if (!supabase) return false;
  const { data } = await (supabase.rpc as unknown as Rpc)("cancel_request_by_token", {
    p_token: token,
    p_reason: reason,
  });
  return data === true;
}
