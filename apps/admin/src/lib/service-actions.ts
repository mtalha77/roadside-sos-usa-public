"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

/** Hides, requires or reorders one Get Help question for a market or every market (RSOS-116). */
export async function setQuestionAction(form: FormData) {
  const ctx = await getAdminContext();
  const p = z
    .object({
      market: z.union([z.literal("all"), z.uuid()]),
      service: z.string().regex(/^[a-z-]{2,40}$/),
      question: z.string().regex(/^[A-Za-z]{2,40}$/),
      hidden: z.boolean(),
      required: z.enum(["default", "yes", "no"]),
      sort: z.union([z.literal(""), z.coerce.number().int().min(-100).max(100)]),
    })
    .safeParse({
      market: form.get("market"),
      service: form.get("service"),
      question: form.get("question"),
      hidden: form.get("hidden") === "on",
      required: form.get("required"),
      sort: form.get("sort") ?? "",
    });
  const back = `/services?market=${String(form.get("market") ?? "all")}&service=${String(form.get("service") ?? "")}`;
  if (!p.success || (ctx.role !== "super_admin" && ctx.role !== "ops_manager"))
    redirect(`${back}&error=1`);
  const d = p.data;
  const supabase = await getServerSupabase();
  const { error } = await (
    supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ error: unknown }>
  )("set_question_override", {
    p_market_id: d.market === "all" ? null : d.market,
    p_service: d.service,
    p_question: d.question,
    p_hidden: d.hidden,
    p_required: d.required === "default" ? null : d.required === "yes",
    p_sort: d.sort === "" ? null : d.sort,
  });
  revalidatePath("/services");
  redirect(`${back}&${error ? "error=1" : "done=1"}#q-${d.question}`);
}
