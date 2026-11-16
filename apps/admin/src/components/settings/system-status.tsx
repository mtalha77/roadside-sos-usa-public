import "server-only";
import { ADAPTER_KEYS, type AdapterName } from "@rsos/config/adapters";
import { appUrl } from "@rsos/config/site";
import { type Health, getHealth } from "@rsos/db/health";
import { Badge } from "@rsos/ui/badge";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

const card = "rounded-2xl border bg-card p-4 sm:p-5";
const APPS = ["web", "provider", "admin"] as const;
const State = z.enum(["real", "fake", "missing"]);
const HealthSchema = z.object({
  ok: z.boolean(),
  app: z.enum(APPS),
  environment: z.enum(["production", "staging", "preview", "development"]),
  commit: z.string().nullable(),
  demoMode: z.boolean(),
  database: z.enum(["ok", "error", "not-configured"]),
  serviceKey: z.enum(["match", "mismatch", "unverifiable", "missing", "not-used"]),
  adapters: z.record(z.string(), State),
  demoSignIn: z.enum(["ok", "unavailable"]).optional(),
});

/** Another app's /api/health, parsed; null when it cannot be reached (for example a protected preview). */
async function remoteHealth(app: "web" | "provider"): Promise<Health | null> {
  try {
    const res = await fetch(new URL("/api/health", appUrl(app)), {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const parsed = HealthSchema.safeParse(await res.json());
    return parsed.success ? (parsed.data as Health) : null;
  } catch {
    return null;
  }
}

const tone = (good: boolean, warn = false) => (good ? "success" : warn ? "warning" : "critical");

/**
 * System status (RSOS-099): each app's environment, commit, database, service key project and
 * third-party adapters (real, fake or missing). Values are never shown, only states.
 */
export async function SystemStatus() {
  const [t, admin, web, provider] = await Promise.all([
    getTranslations("admin.settings.system"),
    getHealth("admin"),
    remoteHealth("web"),
    remoteHealth("provider"),
  ]);
  const all: Record<(typeof APPS)[number], Health | null> = { web, provider, admin };
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
                          <Badge tone={tone(s === "real", s === "fake")}>{t(`state.${s}`)}</Badge>
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
    </div>
  );
}
