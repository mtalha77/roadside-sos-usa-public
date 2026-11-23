import { LiteMap } from "@rsos/ui/lite-map";
import { getTranslations } from "next-intl/server";
import { TeamPanel } from "@/components/team/team-panel";
import { card, PageHead, pageMain } from "@/components/shell/page-head";
import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load() {
  const ctx = await getPortalContext();
  const { data } = await getPortalData(ctx, Date.now());
  return { ctx, data };
}

/**
 * Team and multi-truck dispatch (RSOS-060): invite operators by text, roles, live team map, and
 * job assignment by managers. Operators see only their own assigned jobs.
 */
export default async function TeamPage() {
  const [t, { ctx, data }] = await Promise.all([getTranslations("portal.team"), load()]);
  const me = data.team[0]?.name;
  const visibleJobs =
    ctx.role === "operator" ? data.activeJobs.filter((j) => j.operator === me) : data.activeJobs;
  return (
    <main id="main" className={pageMain}>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <section className={card} aria-labelledby="map-h">
        <h2 id="map-h" className="mb-3 font-semibold">
          {t("map")}
        </h2>
        <LiteMap
          label={t("map")}
          points={data.team.map((m) => ({
            id: m.id,
            lat: m.lat,
            lng: m.lng,
            kind: "truck" as const,
            tone: m.online ? ("success" as const) : ("neutral" as const),
            label: `${m.name} · ${m.online ? t("online") : t("offline")}`,
          }))}
        />
      </section>
      <TeamPanel
        canManage={ctx.role !== "operator"}
        members={data.team.map((m) => ({
          id: m.id,
          name: m.name,
          truck: m.truck,
          online: m.online,
          role: m.role,
          roleLabel: t(`roles.${m.role}`),
        }))}
        jobs={visibleJobs.map((j) => ({
          id: j.id,
          code: j.code,
          area: j.area,
          operator: j.operator,
        }))}
        labels={{
          members: t("members"),
          online: t("online"),
          offline: t("offline"),
          invite: t("invite"),
          phone: t("phone"),
          name: t("name"),
          role: t("role"),
          send: t("send"),
          sent: t("sent"),
          roles: t("roles.operator"),
          rolesManager: t("roles.manager"),
          jobs: t("jobs"),
          assign: t("assign"),
          noJobs: t("noJobs"),
          onlyMine: t("onlyMine"),
          assigned: t("assigned"),
        }}
      />
    </main>
  );
}
