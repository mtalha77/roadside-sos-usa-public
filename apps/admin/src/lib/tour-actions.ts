"use server";

import { saveTourProgress } from "@rsos/db/tours";
import { getServerSupabase } from "@/lib/supabase/server";

/** Saves the signed-in staff member's place in a tour (their own row; RLS enforces it). */
export async function saveTourAction(tour: string, status: string, step: number): Promise<void> {
  await saveTourProgress(await getServerSupabase(), { tour, status, step });
}
