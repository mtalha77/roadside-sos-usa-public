"use server";

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

const Input = z.object({
  bookingId: z.uuid(),
  step: z.enum(["on_my_way", "arrived", "done", "not_available", "no_show", "cancel"]),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  code: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  photos: z.number().int().min(0).max(10),
  device: z.string().max(128).nullable(),
});

const Result = z.enum([
  "en_route",
  "on_site",
  "done",
  "wrong_code",
  "locked",
  "no_show",
  "cancelled",
  "booked",
  "replaced",
]);
export type JobStepResult = z.infer<typeof Result> | "too_far" | "error";

/**
 * One step of a real job (RSOS-117): On my way, Arrived (GPS within about 200 m), Done with the
 * customer's code, or Customer not available with 2 photos. The database checks the rules,
 * charges or releases the reserved fee and raises the warning flags.
 */
export async function jobStepAction(input: z.input<typeof Input>): Promise<JobStepResult> {
  const p = Input.safeParse(input);
  if (!p.success) return "error";
  const s = await getServerSupabase();
  const { data, error } = await (
    s.rpc.bind(s) as unknown as (
      f: string,
      a: object,
    ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
  )("provider_job_step", {
    p_booking_id: p.data.bookingId,
    p_step: p.data.step,
    p_lat: p.data.lat,
    p_lng: p.data.lng,
    p_code: p.data.code,
    p_photos: p.data.photos,
    p_device: p.data.device,
  });
  if (error) return error.message?.includes("not at the customer") ? "too_far" : "error";
  return Result.safeParse(data).data ?? "error";
}
