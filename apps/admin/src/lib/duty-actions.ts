"use server";

import { createAdminSupabase } from "@rsos/db/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

const DISPATCH_ROLES = ["super_admin", "ops_manager", "dispatcher"];

/** A dispatcher sets their own presence and the "I am on duty now" toggle (RLS: own row only). */
export async function setMyStatusAction(form: FormData): Promise<void> {
  const ctx = await getAdminContext();
  if (!DISPATCH_ROLES.includes(ctx.role) || !ctx.userId) return;
  const parsed = z
    .object({ presence: z.enum(["available", "busy", "away"]), onDuty: z.boolean() })
    .safeParse({ presence: form.get("presence"), onDuty: form.get("onDuty") === "on" });
  if (!parsed.success) return;
  await (await getServerSupabase()).from("dispatcher_status").upsert({
    user_id: ctx.userId,
    presence: parsed.data.presence,
    on_duty_now: parsed.data.onDuty,
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/settings");
}

/** Your own mobile number, rung when no browser answers (stored on your staff record). */
export async function setMyMobileAction(form: FormData): Promise<void> {
  const ctx = await getAdminContext();
  if (!DISPATCH_ROLES.includes(ctx.role) || !ctx.userId) return;
  const d = String(form.get("mobile") ?? "")
    .replace(/\D/g, "")
    .replace(/^1(?=\d{10}$)/, "");
  const mobile = /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? `+1${d}` : d === "" ? null : undefined;
  if (mobile === undefined) return;
  // Staff rows are written by the server only; the user id comes from the verified session.
  await createAdminSupabase()
    .from("staff_members")
    .update({ mobile_phone: mobile })
    .eq("user_id", ctx.userId);
  revalidatePath("/settings");
}

export async function addShiftAction(form: FormData): Promise<void> {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin" && ctx.role !== "ops_manager") return;
  const parsed = z
    .object({
      userId: z.uuid(),
      weekday: z.coerce.number().int().min(0).max(6),
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timeZone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_/]+$/),
    })
    .safeParse({
      userId: form.get("userId"),
      weekday: form.get("weekday"),
      start: form.get("start"),
      end: form.get("end"),
      timeZone: form.get("timeZone"),
    });
  if (!parsed.success) return;
  const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const start = min(parsed.data.start);
  const end = parsed.data.end === "00:00" ? 1440 : min(parsed.data.end);
  if (end <= start) return;
  await (await getServerSupabase()).from("dispatcher_shifts").insert({
    user_id: parsed.data.userId,
    weekday: parsed.data.weekday,
    start_minute: start,
    end_minute: end,
    time_zone: parsed.data.timeZone,
  });
  revalidatePath("/settings");
}

export async function removeShiftAction(form: FormData): Promise<void> {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin" && ctx.role !== "ops_manager") return;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await (await getServerSupabase()).from("dispatcher_shifts").delete().eq("id", id.data);
  revalidatePath("/settings");
}
