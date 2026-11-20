"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

const Input = z.object({
  id: z.uuid(),
  resolution: z.string().trim().max(500).optional(),
  back: z
    .string()
    .regex(/^\/[A-Za-z0-9/_?=&%-]*$/)
    .max(200),
});

/** Close a flag with a short note (dispatchers, operations and support; checked again in SQL). */
export async function resolveFlagAction(form: FormData) {
  const ctx = await getAdminContext();
  if (!["super_admin", "ops_manager", "dispatcher", "support"].includes(ctx.role)) return;
  const p = Input.safeParse({
    id: form.get("id"),
    resolution: form.get("resolution") ?? undefined,
    back: form.get("back"),
  });
  if (!p.success) return;
  const s = await getServerSupabase();
  await (s.rpc.bind(s) as unknown as (f: string, a: object) => PromiseLike<unknown>)(
    "resolve_request_flag",
    { p_id: p.data.id, p_resolution: p.data.resolution ?? null },
  );
  revalidatePath(p.data.back.split("?")[0] ?? "/inbox");
}
