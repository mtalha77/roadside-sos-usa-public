import { syncHealth } from "@rsos/core/ads";
import "server-only";
import { ADAPTER_KEYS, type AdapterName } from "@rsos/config/adapters";
import { Badge } from "@rsos/ui/badge";
import { inputClass } from "@rsos/ui/input";
import { getAdminContext } from "@/lib/admin";
import { APPS, allHealth } from "@/lib/app-health";
import { getServerSupabase } from "@/lib/supabase/server";
import { updateThresholdAction } from "@/lib/system-actions";
import { getTranslations } from "next-intl/server";

const card = "rounded-2xl border bg-card p-4 sm:p-5";
const tone = (good: boolean, warn = false) => (good ? "success" : warn ? "warning" : "critical");

/**
 * System status (RSOS-099): each app's environment, commit, database, service key project and
 * third-party adapters (real, fake or missing). Values are never shown, only states.
 */
export async function SystemStatus() {
  const [t, all] = await Promise.all([getTranslations("admin.settings.system"), allHealth()]);
  const supabase = await getServerSupabase();
  const [ctx, { data: usage }, { data: thresholds }] = await Promise.all([
    getAdminContext(),
    supabase
      .from("api_usage")
      .select("vendor, units")
      .eq("day", new Date().toISOString().slice(0, 10)),
    supabase.from("usage_thresholds").select("vendor_group, daily_units").order("vendor_group"),
  ]);
  const groupTotal = (g: string) =>
    (usage ?? []).filter((u) => u.vendor.startsWith(`${g}_`)).reduce((n, u) => n + u.units, 0);
  const adapters = Object.keys(ADAPTER_KEYS) as AdapterName[];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <ul className="grid gap-3 lg:grid-cols-3">
        {APPS.map((app) => {
          const h = all[app];
          return (
            <li key={app} className={card}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold">{t(`apps.${app}`)}</h2>
                <Badge tone={h ? tone(h.ok) : "warning"}>
                  {h ? (h.ok ? t("healthy") : t("unhealthy")) : t("unreachable")}
                </Badge>
              </div>
              {h ? (
                <dl className="grid grid-cols-2 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">{t("environment")}</dt>
                  <dd>{h.environment}</dd>
                  <dt className="text-muted-foreground">{t("commit")}</dt>
                  <dd className="font-mono">{h.commit ? h.commit.slice(0, 7) : t("none")}</dd>
                  <dt className="text-muted-foreground">{t("database")}</dt>
                  <dd>
                    <Badge tone={tone(h.database === "ok")}>{t(`db.${h.database}`)}</Badge>
                  </dd>
                  <dt className="text-muted-foreground">{t("serviceKey")}</dt>
                  <dd>
                    <Badge
                      tone={tone(
                        h.serviceKey === "match" || h.serviceKey === "not-used",
                        h.serviceKey === "unverifiable",
                      )}
                    >
                      {t(`key.${h.serviceKey}`)}
                    </Badge>
                  </dd>
                  <dt className="text-muted-foreground">{t("demoMode")}</dt>
                  <dd>{h.demoMode ? t("on") : t("off")}</dd>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">{t("unreachableBody")}</p>
              )}
            </li>
          );
        })}
      </ul>
      <section className={card} aria-labelledby="sys-adapters">
        <h2 id="sys-adapters" className="mb-3 font-semibold">
          {t("adapters")}
        </h2>
        <div tabIndex={0} role="region" aria-labelledby="sys-adapters" className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 pr-3 font-medium">
                  {t("adapter")}
                </th>
                {APPS.map((app) => (
                  <th key={app} scope="col" className="py-2 pr-3 font-medium">
                    {t(`apps.${app}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {adapters.map((a) => (
                <tr key={a}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {t(`adapterNames.${a}`)}
                  </th>
                  {APPS.map((app) => {
                    const s = all[app]?.adapters[a];
                    return (
                      <td key={app} className="py-2 pr-3">
                        {s ? (
                          <Badge tone={tone(s === "real", s === "fake" || s === "deferred")}>
                            {t(`state.${s}`)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{t("none")}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("legend")}</p>
      </section>
      <section className={card} aria-labelledby="sys-usage">
        <h2 id="sys-usage" className="mb-1 font-semibold">
          {t("usage")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("usageIntro")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(thresholds ?? []).map((th) => {
            const used = groupTotal(th.vendor_group);
            return (
              <li key={th.vendor_group} className="flex flex-col gap-2 rounded-xl border p-3">
                <p className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t(`groups.${th.vendor_group}`)}</span>
                  <Badge tone={used >= th.daily_units ? "warning" : "neutral"}>
                    {t("usedOf", { used, limit: th.daily_units })}
                  </Badge>
                </p>
                <ul className="text-sm text-muted-foreground">
                  {(usage ?? [])
                    .filter((u) => u.vendor.startsWith(`${th.vendor_group}_`))
                    .map((u) => (
                      <li key={u.vendor} className="flex justify-between">
                        <span>{u.vendor}</span>
                        <span className="tabular-nums">{u.units}</span>
                      </li>
                    ))}
                </ul>
                {ctx.role === "super_admin" ? (
                  <form action={updateThresholdAction} className="flex items-end gap-2">
                    <input type="hidden" name="group" value={th.vendor_group} />
                    <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
                      {t("threshold")}
                      <input
                        name="units"
                        type="number"
                        min={1}
                        defaultValue={th.daily_units}
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="submit"
                      className="min-h-touch rounded-lg border px-4 text-sm font-medium hover:bg-accent"
                    >
                      {t("save")}
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <AdSyncHealth />
    </div>
  );
}

/** Ad sync health (RSOS-107): last success per job and failures in a row (alert at 3). */
async function AdSyncHealth() {
  const t = await getTranslations("admin.ads.health");
  const { data } = await (
    await getServerSupabase()
  )
    .from("sync_runs")
    .select("job, ok, started_at")
    .order("started_at", { ascending: false })
    .limit(300);
  const health = syncHealth(
    (data ?? []).map((r) => ({ job: r.job, ok: r.ok, at: Date.parse(r.started_at) })),
  );
  const when = (at: number | null) =>
    at === null
      ? "–"
      : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(at);
  return (
    <section className="rounded-2xl border bg-card p-4" aria-labelledby="ads-health-h">
      <h3 id="ads-health-h" className="mb-1 font-semibold">
        {t("title")}
      </h3>
      <p className="mb-3 text-sm text-muted-foreground">{t("note")}</p>
      {health.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="divide-y text-sm">
          {health.map((h) => (
            <li key={h.job} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-mono">{h.job}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {t("lastOk")}: {when(h.lastOk)}
                </span>
                <Badge tone={h.alert ? "critical" : h.failures ? "warning" : "success"}>
                  {t("failures")}: {h.failures}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
