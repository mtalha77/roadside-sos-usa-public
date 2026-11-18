import {
  canManageRole,
  PROVIDER_ROLES,
  SECTION_ROLES,
  STAFF_ROLES,
  type StaffRole,
} from "@rsos/config/permissions";
import { createAdminSupabase } from "@rsos/db/admin";
import { Badge } from "@rsos/ui/badge";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { InviteForm, MemberForm } from "@/components/team/team-forms";
import { getAdminContext } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Admin > Team & roles (RSOS-102): every role in plain language with what it can open, who has
 * it, invites by email, role and market changes, deactivation. Owners manage everyone; operations
 * managers manage everyone except owners. Every change goes to the audit log.
 */
export default async function TeamPage() {
  const [t, ts, ctx] = await Promise.all([
    getTranslations("admin.team"),
    getTranslations("admin"),
    getAdminContext(),
  ]);
  if (ctx.role !== "super_admin" && ctx.role !== "ops_manager") redirect("/no-access");
  const admin = createAdminSupabase();
  const { data: staff } = await admin
    .from("staff_members")
    .select("user_id, display_name, role, market_ids, is_active")
    .order("display_name");
  const members = await Promise.all(
    (staff ?? []).map(async (s) => ({
      ...s,
      email: (await admin.auth.admin.getUserById(s.user_id)).data.user?.email ?? "",
    })),
  );
  const roleName = (r: string) => ts(`roles.${r}.name`);
  const marketName = (id: string) => ctx.markets.find((m) => m.id === id)?.name ?? id;
  const assignable = STAFF_ROLES.filter((r) => canManageRole(ctx.role, r)).map((r) => ({
    value: r,
    label: roleName(r),
  }));
  const marketOptions = ctx.markets.map((m) => ({ value: m.id, label: m.name }));
  const card = "rounded-2xl border bg-card p-4 sm:p-5";
  const sections = (r: StaffRole) =>
    (Object.keys(SECTION_ROLES) as (keyof typeof SECTION_ROLES)[])
      .filter((k) => (SECTION_ROLES[k] as readonly string[]).includes(r))
      .filter((k) => k !== "account" && k !== "today" && k !== "walkthrough")
      .map((k) => ts(`sections.${k}`))
      .join(", ");
  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <section aria-labelledby="roles-h" className={card}>
        <h2 id="roles-h" className="mb-3 text-lg font-semibold">
          {t("staffRoles")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {STAFF_ROLES.map((r) => (
            <li key={r} className="flex flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {roleName(r)}
                <Badge tone="neutral">
                  {t("people", {
                    count: members.filter((m) => m.role === r && m.is_active).length,
                  })}
                </Badge>
              </p>
              <p className="text-sm text-muted-foreground">{ts(`roles.${r}.who`)}</p>
              <p className="text-sm">{ts(`roles.${r}.can`)}</p>
              <p className="text-xs text-muted-foreground">
                {t("opens", { sections: sections(r) })}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="members-h" className={card}>
        <h2 id="members-h" className="mb-3 text-lg font-semibold">
          {t("members")}
        </h2>
        <ul className="flex flex-col divide-y">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.display_name}{" "}
                  {m.is_active ? null : <Badge tone="warning">{t("inactive")}</Badge>}
                </p>
                <p className="text-sm break-all text-muted-foreground">{m.email}</p>
              </div>
              <p className="text-sm">
                {roleName(m.role)} ·{" "}
                {m.market_ids?.length
                  ? m.market_ids.map(marketName).join(", ")
                  : ts("roles.allMarkets")}
              </p>
              <MemberForm
                userId={m.user_id}
                role={m.role}
                chosen={m.market_ids}
                active={m.is_active}
                roles={assignable}
                markets={marketOptions}
                canManage={canManageRole(ctx.role, m.role)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="invite-h" className={card}>
        <h2 id="invite-h" className="mb-3 text-lg font-semibold">
          {t("inviteTitle")}
        </h2>
        <InviteForm roles={assignable} markets={marketOptions} />
      </section>

      <section aria-labelledby="proles-h" className={card}>
        <h2 id="proles-h" className="mb-1 text-lg font-semibold">
          {t("providerRoles")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("providerRolesIntro")}</p>
        <ul className="grid gap-4 md:grid-cols-3">
          {PROVIDER_ROLES.map((r) => (
            <li key={r} className="flex flex-col gap-1">
              <p className="font-semibold">{ts(`providerRoles.${r}.name`)}</p>
              <p className="text-sm text-muted-foreground">{ts(`providerRoles.${r}.who`)}</p>
              <p className="text-sm">{ts(`providerRoles.${r}.can`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
