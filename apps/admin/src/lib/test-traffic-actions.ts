"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * The test traffic list (owner decision 2): IP addresses and test devices whose website visits are
 * tagged as test and left out of analytics and ad conversions. A device joins by opening its link
 * once; the link carries a random token, stored here, never a personal detail.
 */
type Rpc = (
  f: string,
  a: object,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const back = (q: string): never => {
  revalidatePath("/settings");
  redirect(`/settings?tab=system&${q}#test-traffic`);
};

async function allowed() {
  const ctx = await getAdminContext();
  if (!["super_admin", "ops_manager", "marketing"].includes(ctx.role)) back("tt=forbidden");
}

export async function addTestIpAction(form: FormData) {
  await allowed();
  const p = z
    .object({
      ip: z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]),
      label: z.string().trim().min(1).max(80),
    })
    .safeParse({ ip: String(form.get("ip") ?? "").trim(), label: form.get("label") });
  if (!p.success) return back("tt=invalid");
  const s = await getServerSupabase();
  const { error } = await (s.rpc.bind(s) as unknown as Rpc)("add_test_traffic_rule", {
    p_kind: "ip",
    p_value: p.data.ip,
    p_label: p.data.label,
  });
  back(error ? "tt=invalid" : "tt=added");
}

export async function addTestDeviceAction(form: FormData) {
  await allowed();
  const label = z.string().trim().min(1).max(80).safeParse(form.get("label"));
  if (!label.success) return back("tt=invalid");
  const token = randomBytes(24).toString("base64url");
  const s = await getServerSupabase();
  const { error } = await (s.rpc.bind(s) as unknown as Rpc)("add_test_traffic_rule", {
    p_kind: "device",
    p_value: token,
    p_label: label.data,
  });
  back(error ? "tt=invalid" : `tt=device&device=${token}`);
}

export async function removeTestRuleAction(form: FormData) {
  await allowed();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return back("tt=invalid");
  const s = await getServerSupabase();
  const { error } = await (s.rpc.bind(s) as unknown as Rpc)("remove_test_traffic_rule", {
    p_id: id.data,
  });
  back(error ? "tt=invalid" : "tt=removed");
}
