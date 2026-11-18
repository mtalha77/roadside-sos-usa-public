import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "./database.types";

/** Tour progress (RSOS-105): one row per person and tour, readable and writable only by them. */
export const TourId = z.string().regex(/^[a-z0-9][a-z0-9_.-]{1,60}$/);
export const TourStatus = z.enum(["started", "done", "skipped", "hidden"]);
export const TourSave = z.object({
  tour: TourId,
  status: TourStatus,
  step: z.number().int().min(0).max(50),
});
export type TourProgress = Record<string, z.infer<typeof TourStatus>>;

type Client = SupabaseClient<Database>;

/** The signed-in person's tours and where each stands (RLS returns only their own rows). */
export async function readTourProgress(supabase: Client): Promise<TourProgress> {
  const { data } = await supabase.from("tour_progress").select("tour, status");
  return Object.fromEntries(
    (data ?? []).flatMap((r) => {
      const s = TourStatus.safeParse(r.status);
      return s.success ? [[r.tour, s.data]] : [];
    }),
  );
}

/** Saves where the person is in a tour. Invalid input is ignored (it comes from the browser). */
export async function saveTourProgress(supabase: Client, input: unknown): Promise<void> {
  const parsed = TourSave.safeParse(input);
  if (!parsed.success) return;
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return;
  await supabase
    .from("tour_progress")
    .upsert({ user_id: userId, ...parsed.data }, { onConflict: "user_id,tour" });
}

/** A tour starts on its own only the first time (no saved progress at all). */
export const shouldAutoStart = (progress: TourProgress, tour: string) => !(tour in progress);
