import "server-only";
import { createPublicSupabase } from "@rsos/db/public";
import { z } from "zod";

export const RealRequestSchema = z.object({
  short_code: z.string(),
  status: z.enum([
    "draft",
    "phone_intake",
    "submitted",
    "quoting",
    "quoted",
    "contacted",
    "location_confirmed",
    "assigned",
    "accepted",
    "en_route",
    "on_site",
    "completed",
    "cancelled",
    "expired",
    "no_provider",
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

/** Instant book (RSOS-109): the customer's choice, saved with the status link (before booking). */
export async function setBookingMode(
  token: string,
  mode: "compare" | "instant",
  maxCents: number,
): Promise<boolean> {
  const supabase = createPublicSupabase();
  if (!supabase) return false;
  const { data } = await (supabase.rpc as unknown as Rpc)("set_booking_mode", {
    p_token: token,
    p_mode: mode,
    p_max_cents: mode === "instant" ? maxCents : null,
  });
  return data === true;
}

export const RealBookingSchema = z.object({
  booking_id: z.string(),
  provider_name: z.string(),
  price_cents: z.number().int(),
  promised_at: z.string(),
  status: z.enum(["booked", "en_route", "on_site", "done", "cancelled", "replaced"]),
  code: z.string().nullable(),
  booking_fee_cents: z.number().int(),
  booking_fee_status: z.enum(["none", "paid", "refunded", "kept"]),
  free_cancel_until: z.string(),
  can_request_backup: z.boolean(),
  needs_answer: z.boolean(),
  customer_answer: z.enum(["fixed", "not_fixed"]).nullable(),
  rating: z.number().int().nullable(),
});
export type RealBooking = z.infer<typeof RealBookingSchema>;

/** The booking behind a real request (RSOS-117): provider, code, booking fee, backup, answer. */
export async function getRealBooking(token: string): Promise<RealBooking | null> {
  const supabase = createPublicSupabase();
  if (!supabase || token.length < 24) return null;
  const { data } = await (supabase.rpc as unknown as Rpc)("booking_for_token", { p_token: token });
  const row = Array.isArray(data) ? data[0] : null;
  return row ? (RealBookingSchema.safeParse(row).data ?? null) : null;
}

/** "Yes, fixed" or "No" (once), with an optional rating and, for "No", what went wrong. */
export async function answerRealBooking(
  token: string,
  fixed: boolean,
  rating: number | null,
  note: string | null,
): Promise<boolean> {
  const supabase = createPublicSupabase();
  if (!supabase) return false;
  const { data } = await (supabase.rpc as unknown as Rpc)("answer_booking", {
    p_token: token,
    p_fixed: fixed,
    p_rating: rating,
    p_note: note,
  });
  return data === true;
}

/** "Find me another provider" (15 minutes past the promised arrival). */
export async function requestBackup(token: string): Promise<boolean> {
  const supabase = createPublicSupabase();
  if (!supabase) return false;
  const { data } = await (supabase.rpc as unknown as Rpc)("request_backup", { p_token: token });
  return data === true;
}
