import { Badge } from "@rsos/ui/badge";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { FlagsPanel } from "@/components/settings/flags-panel";
import { SystemStatus } from "@/components/settings/system-status";
import { TemplateEditor } from "@/components/settings/template-editor";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABS = ["users", "audit", "templates", "rules", "flags", "integrations", "system"] as const;
const INTEGRATIONS = [
  "google_ads",
  "meta",
  "microsoft_ads",
  "twilio",
  "stripe",
  "google_maps",
  "resend",
] as const;
const card = "rounded-2xl border bg-card p-4 sm:p-5";

async function load(tab: string) {
  const ctx = await getAdminContext();
  const supabase = await getServerSupabase();
  if (tab === "users") {
    const { data } = await supabase
      .from("staff_members")
      .select("user_id, display_name, role, is_active, market_ids")
      .order("display_name");
    return { ctx, staff: data ?? [], audit: [] };
  }
  if (tab === "audit") {
    const { data } = await supabase
      .from("audit_log")
      .select("id, action, actor_role, entity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return { ctx, staff: [], audit: data ?? [] };
  }
  return { ctx, staff: [], audit: [] };
}

/**
 * Settings (RSOS-083, 084, 094): admin users and roles and the audit log (real, super admins);
 * message templates in English and Spanish, business rules per market and feature flags; and
 * integration cards with status (placeholders until the accounts exist).
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = TABS.find((x) => x === sp.tab) ?? "users";
  const [t, locale, { ctx, staff, audit }] = await Promise.all([
    getTranslations("admin.settings"),
    getLocale(),
    load(tab),
  ]);
  const time = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const isSuper = ctx.role === "super_admin";
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <nav aria-label={t("sections")} className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((x) => (
          <Link
            key={x}
            href={`/settings?tab=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className="flex min-h-12 shrink-0 items-center border-b-2 border-transparent px-4 font-medium aria-[current=page]:border-primary"
          >
            {t(`tabs.${x}`)}
          </Link>
        ))}
      </nav>
      {tab === "users" ? (
        <section className={card} aria-labelledby="u-h">
          <h2 id="u-h" className="mb-3 font-semibold">
            {t("tabs.users")}
          </h2>
          {!isSuper ? <p className="mb-2 text-sm text-muted-foreground">{t("onlyYou")}</p> : null}
          <ul className="divide-y text-sm">
            {staff.map((s) => (
              <li
                key={s.user_id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="font-medium">{s.display_name}</span>
                <span className="flex items-center gap-2">
                  <Badge tone="neutral">{s.role}</Badge>
                  {s.is_active ? null : <Badge tone="warning">{t("inactive")}</Badge>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">{t("viewAs")}</p>
          <Link href="/staff" className="mt-2 inline-flex min-h-12 items-center text-sm underline">
            {t("manageStaff")}
          </Link>
        </section>
      ) : null}
      {tab === "audit" ? (
        <section className={card} aria-labelledby="a-h">
          <h2 id="a-h" className="mb-3 font-semibold">
            {t("tabs.audit")}
          </h2>
          {!isSuper ? (
            <p className="text-sm text-muted-foreground">{t("superOnly")}</p>
          ) : audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAudit")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{a.action}</span>{" "}
                    <span className="text-muted-foreground">
                      · {a.entity_type} · {a.actor_role ?? "system"}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {time.format(Date.parse(a.created_at))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {tab === "templates" ? (
        <TemplateEditor
          templates={(
            ["request_received", "provider_picked", "provider_arriving", "job_completed"] as const
          ).map((k) => ({
            id: k,
            name: t(`templates.${k}.name`),
            en: t(`templates.${k}.en`),
            es: t(`templates.${k}.es`),
          }))}
          labels={Object.fromEntries(
            [
              "template",
              "channel",
              "english",
              "spanish",
              "preview",
              "save",
              "saved",
              "variables",
            ].map((k) => [k, t(`tpl.${k}`)]),
          )}
          channels={(["sms", "email", "push"] as const).map((c) => ({
            id: c,
            label: t(`channels.${c}`),
          }))}
        />
      ) : null}
      {tab === "rules" ? (
        <section className={card} aria-labelledby="r-h">
          <h2 id="r-h" className="mb-3 font-semibold">
            {t("tabs.rules")}
          </h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[16rem_1fr]">
            {(["quoteWindow", "radiusSteps", "maxQuotes", "autoExpire", "cancelFee"] as const).map(
              (k) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{t(`rules.${k}.label`)}</dt>
                  <dd>{t(`rules.${k}.value`)}</dd>
                </div>
              ),
            )}
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">{t("rulesHint")}</p>
        </section>
      ) : null}
      {tab === "flags" ? (
        <FlagsPanel
          flags={(
            [
              "spanish_site",
              "phone_intake",
              "auto_pick",
              "featured_slots",
              "driver_accounts",
            ] as const
          ).map((f) => ({
            id: f,
            label: t(`flags.${f}.label`),
            hint: t(`flags.${f}.hint`),
          }))}
          labels={{ saved: String(t.raw("flagSaved")), title: t("tabs.flags") }}
        />
      ) : null}
      {tab === "integrations" ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((i) => (
            <li key={i} className={`${card} flex flex-col gap-2`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{t(`integrations.${i}`)}</h2>
                <Badge
                  tone={i === "resend" || i === "twilio" || i === "stripe" ? "warning" : "neutral"}
                >
                  {t("notConnected")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t("lastSync", { when: t("never") })}</p>
              <button
                type="button"
                disabled
                className="mt-auto min-h-12 rounded-lg border px-4 text-sm font-medium text-muted-foreground"
              >
                {t("connect")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "system" ? <SystemStatus /> : null}
    </main>
  );
}
