"use server";

import { parseClaims } from "@rsos/db/claims";
import { createAdminSupabase } from "@rsos/db/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

export type StaffActionState = { ok?: string; error?: "forbidden" | "generic" };

/** Super admins only (checked from the verified JWT, aal2): removes a staff member's authenticator. */
export async function resetSecondStepAction(
  _: StaffActionState,
  form: FormData,
): Promise<StaffActionState> {
  const userId = z.uuid().safeParse(form.get("userId"));
  if (!userId.success) return { error: "generic" };
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = parseClaims(data?.claims);
  if (claims?.staff_role !== "super_admin" || claims.aal !== "aal2") return { error: "forbidden" };
  const admin = createAdminSupabase();
  const { data: target } = await admin.auth.admin.getUserById(userId.data);
  if (!target.user) return { error: "generic" };
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: userId.data });
  for (const f of factors?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: userId.data, id: f.id });
    if (error) return { error: "generic" };
  }
  // Sign the member out everywhere so the next sign-in sets up a new authenticator.
  await admin.auth.admin.signOut(userId.data, "global").catch(() => undefined);
  await supabase.rpc("log_security_event", {
    p_action: "auth.staff_second_step_reset",
    p_data: { target_user_id: userId.data },
  });
  revalidatePath("/staff");
  return { ok: target.user.email ?? "" };
}
