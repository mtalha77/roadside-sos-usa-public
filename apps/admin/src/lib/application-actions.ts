"use server";

import { appUrl } from "@rsos/config/site";
import {
  ApplicationApprovedEmail,
  applicationApprovedSubject,
  chooseEmailSender,
} from "@rsos/emails";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Approves a real provider application (super admins and ops managers; RLS enforces it too) and
 * emails the applicant (Resend, or the fake that records it when the key is missing).
 */
export async function approveApplicationAction(id: string): Promise<"ok" | "forbidden" | "error"> {
  const ctx = await getAdminContext();
  if (ctx.role !== "super_admin" && ctx.role !== "ops_manager") return "forbidden";
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return "error";
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("provider_applications")
    .update({ status: "approved" })
    .eq("id", parsed.data)
    .neq("status", "approved")
    .select("contact_name, company_name, email")
    .maybeSingle();
  if (error || !data) return "error";
  await chooseEmailSender()
    .send({
      to: data.email,
      subject: applicationApprovedSubject(),
      react: ApplicationApprovedEmail({
        name: data.contact_name,
        company: data.company_name,
        portalUrl: appUrl("provider"),
      }),
      tags: { category: "application_approved" },
    })
    .catch(() => null);
  revalidatePath("/recruitment");
  return "ok";
}
