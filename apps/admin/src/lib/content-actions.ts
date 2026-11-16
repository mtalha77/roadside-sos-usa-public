"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

const Input = z.object({ slug: z.string().min(1).max(80), intro: z.string().min(40).max(1200) });

export type SaveIntroState = { status: "idle" | "saved" | "invalid" | "forbidden" | "error" };

/** Saves a market's city page intro (real data, audited in the database). */
export async function saveMarketIntro(
  _prev: SaveIntroState,
  form: FormData,
): Promise<SaveIntroState> {
  const parsed = Input.safeParse({ slug: form.get("slug"), intro: form.get("intro") });
  if (!parsed.success) return { status: "invalid" };
  const supabase = await getServerSupabase();
  const { error } = await (
    supabase.rpc as unknown as (
      f: string,
      a: object,
    ) => PromiseLike<{ error: { code?: string } | null }>
  )("admin_update_market_intro", { p_slug: parsed.data.slug, p_intro: parsed.data.intro });
  if (error)
    return {
      status: error.code === "42501" ? "forbidden" : error.code === "22023" ? "invalid" : "error",
    };
  revalidatePath("/content");
  return { status: "saved" };
}
