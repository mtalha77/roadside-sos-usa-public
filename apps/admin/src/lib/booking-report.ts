import "server-only";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

const Row = z.object({
  market_id: z.string(),
  picked: z.number().int(),
  paid: z.number().int(),
  refunded: z.number().int(),
  charged_cents: z.coerce.number(),
  refunded_cents: z.coerce.number(),
});
export type BookingFeeRow = z.infer<typeof Row>;

/**
 * Customer bookings and booking fees per market over the last `days` days (RSOS-117): picked,
 * paid the booking fee, refunded, and the money. Feeds Finance and the Analytics funnel.
 */
export async function getBookingFeeReport(days = 30): Promise<BookingFeeRow[]> {
  const supabase = await getServerSupabase();
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const { data } = await (
    supabase.rpc.bind(supabase) as unknown as (
      f: string,
      a: object,
    ) => PromiseLike<{ data: unknown }>
  )("booking_fee_report", { p_from: from.toISOString(), p_to: to.toISOString() });
  return z
    .array(Row)
    .catch([])
    .parse(data ?? []);
}
