"use server";

import { isDemoMode } from "@rsos/config/demo";
import { canManageRole, STAFF_ROLES, type StaffRole } from "@rsos/config/permissions";
import { appUrl } from "@rsos/config/site";
import { createAdminSupabase } from "@rsos/db/admin";
import type { Json } from "@rsos/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";

export type TeamState = { ok?: string; error?: string; inviteLink?: string };

const Role = z.enum(STAFF_ROLES);
const Markets = z.array(z.uuid()).max(50);

/** Who is acting, and whether they may manage `target` (owners manage owners; RSOS-102). */
async function actor(target: StaffRole) {
  const ctx = await getAdminContext();
  return canManageRole(ctx.role, target) ? ctx : null;
}

async function audit(
  ctx: { userId: string; role: string },
  action: string,
  userId: string,
  data: Json,
) {
  await createAdminSupabase().from("audit_log").insert({
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action,
    entity_type: "staff_member",
    entity_id: userId,
    data,
  });
}

/** At least one active owner must always exist. */
async function ownersLeftWithout(userId: string) {
  const { count } = await createAdminSupabase()
    .from("staff_members")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("is_active", true)
    .neq("user_id", userId);
  return count ?? 0;
}

const parseMarkets = (form: FormData) => {
  const ids = form.getAll("markets").map(String).filter(Boolean);
  return ids.length ? Markets.safeParse(ids) : ({ success: true, data: null } as const);
};

/**
 * Invite a team member by email with a role and an optional market limit. Production sends
 * Supabase's invite email; demo hosts create the account and show a one-time link instead (test
 * addresses have no inbox).
 */
export async function inviteAction(_: TeamState, form: FormData): Promise<TeamState> {
  const parsed = z
    .object({
      email: z.email().max(254),
      name: z.string().trim().min(2).max(80),
      role: Role,
    })
    .safeParse({
      email: String(form.get("email") ?? "")
        .trim()
        .toLowerCase(),
      name: form.get("name"),
      role: form.get("role"),
    });
  const markets = parseMarkets(form);
  if (!parsed.success || !markets.success) return { error: "invalid" };
  const ctx = await actor(parsed.data.role);
  if (!ctx) return { error: "forbidden" };
  const admin = createAdminSupabase();
  const redirectTo = `${appUrl("admin")}/auth/callback?next=/account`;
  let userId: string | undefined;
  let inviteLink: string | undefined;
  if (isDemoMode()) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email: parsed.data.email,
      options: { redirectTo },
    });
    if (error && !/already/i.test(error.message)) return { error: "generic" };
    userId = data?.user?.id;
    inviteLink = data?.properties?.action_link;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo,
    });
    if (error && !/already/i.test(error.message)) return { error: "generic" };
    userId = data?.user?.id;
  }
  if (!userId) {
    // Already has an account: find it.
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      userId = data.users.find((u) => u.email === parsed.data.email)?.id;
      if (data.users.length < 1000) break;
    }
  }
  if (!userId) return { error: "generic" };
  const { error } = await admin.from("staff_members").upsert({
    user_id: userId,
    role: parsed.data.role,
    display_name: parsed.data.name,
    market_ids: markets.data,
    is_active: true,
  });
  if (error) return { error: "generic" };
  await audit(ctx, "team.invite", userId, {
    role: parsed.data.role,
    markets: markets.data,
    email: parsed.data.email,
  });
  revalidatePath("/team");
  return { ok: "invited", ...(inviteLink ? { inviteLink } : {}) };
}

/** Change a member's role and market limit. */
export async function updateMemberAction(_: TeamState, form: FormData): Promise<TeamState> {
  const parsed = z
    .object({ userId: z.uuid(), role: Role })
    .safeParse({ userId: form.get("userId"), role: form.get("role") });
  const markets = parseMarkets(form);
  if (!parsed.success || !markets.success) return { error: "invalid" };
  const admin = createAdminSupabase();
  const { data: current } = await admin
    .from("staff_members")
    .select("role")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!current) return { error: "invalid" };
  // Both the old and the new role must be manageable (an ops manager cannot touch owners).
  const ctx = (await actor(current.role)) && (await actor(parsed.data.role));
  if (!ctx) return { error: "forbidden" };
  if (
    current.role === "super_admin" &&
    parsed.data.role !== "super_admin" &&
    (await ownersLeftWithout(parsed.data.userId)) === 0
  )
    return { error: "lastOwner" };
  const { error } = await admin
    .from("staff_members")
    .update({ role: parsed.data.role, market_ids: markets.data })
    .eq("user_id", parsed.data.userId);
  if (error) return { error: "generic" };
  await audit(ctx, "team.update", parsed.data.userId, {
    from: current.role,
    to: parsed.data.role,
    markets: markets.data,
  });
  revalidatePath("/team");
  return { ok: "saved" };
}

/** Deactivate or reactivate a member (their sign-in stops working while inactive). */
export async function setActiveAction(userId: string, active: boolean): Promise<TeamState> {
  if (!z.uuid().safeParse(userId).success) return { error: "invalid" };
  const admin = createAdminSupabase();
  const { data: current } = await admin
    .from("staff_members")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!current) return { error: "invalid" };
  const ctx = await actor(current.role);
  if (!ctx) return { error: "forbidden" };
  if (!active && userId === ctx.userId) return { error: "self" };
  if (!active && current.role === "super_admin" && (await ownersLeftWithout(userId)) === 0)
    return { error: "lastOwner" };
  const { error } = await admin
    .from("staff_members")
    .update({ is_active: active })
    .eq("user_id", userId);
  if (error) return { error: "generic" };
  await audit(ctx, active ? "team.reactivate" : "team.deactivate", userId, {});
  revalidatePath("/team");
  return { ok: active ? "reactivated" : "deactivated" };
}
