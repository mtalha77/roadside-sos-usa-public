import { parseClaims } from "@rsos/db/claims";
import { createAdminSupabase } from "@rsos/db/admin";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { ResetSecondStep } from "./reset-second-step";

export const dynamic = "force-dynamic";

/** Staff list for super admins: reset a member's lost authenticator. */
export default async function StaffPage() {
  const { data } = await (await getServerSupabase()).auth.getClaims();
  if (parseClaims(data?.claims)?.staff_role !== "super_admin") redirect("/no-access");
  const t = await getTranslations("account");
  const admin = createAdminSupabase();
  const { data: staff } = await admin
    .from("staff_members")
    .select("user_id, display_name, role, is_active")
    .order("display_name");
  const rows = await Promise.all(
    (staff ?? []).map(async (s) => ({
      ...s,
      email: (await admin.auth.admin.getUserById(s.user_id)).data.user?.email ?? "",
    })),
  );
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold">{t("staff")}</h1>
      <ul className="flex flex-col divide-y rounded-xl border bg-surface">
        {rows.map((s) => (
          <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{s.display_name}</p>
              <p className="text-sm text-muted-foreground">
                {s.email} · {s.role}
              </p>
            </div>
            <ResetSecondStep userId={s.user_id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
