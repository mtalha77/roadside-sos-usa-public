import { AD_PLATFORMS, connectionStatus } from "@rsos/core/ads";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { refreshSentryCheck } from "@/lib/app-health";
import {
  mapCampaignAction,
  setAdCodeAction,
  setConnectionAction,
  setPauseRuleAction,
  testConnectionAction,
} from "@/lib/ads-actions";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border bg-card p-4 sm:p-5";
const label = "flex flex-col gap-1.5 text-sm font-medium";
const TONE = {
  connected: "success",
  error: "critical",
  off: "warning",
  not_connected: "neutral",
} as const;

/**
 * Admin > Marketing > Connections (RSOS-107): one card per ad platform (Not connected, Off,
 * Connected or Error, last sync, account name, Test connection, the switch), the market codes for
 * the campaign naming rule, campaigns to map by hand, and the auto-pause rules per market. Key
 * values are never shown: only whether they are set.
 */
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, ctx, sp, sentry] = await Promise.all([
    getTranslations("admin.ads"),
    getAdminContext(),
    searchParams,
    // Owner decision (release 1): no paid ads until Sentry is live in all three apps.
    refreshSentryCheck(),
  ]);
  const supabase = await getServerSupabase();
  const [
    { data: conns },
    { data: campaigns },
    { data: markets },
    { data: services },
    { data: rules },
    { data: events },
  ] = await Promise.all([
    supabase.from("ad_connections").select("*"),
    supabase.from("ad_campaigns").select("*").order("mapped_by_hand").order("name").limit(200),
    supabase.from("markets").select("id, name, ad_code").order("name"),
    supabase.from("services").select("slug, name").order("sort_order"),
    supabase.from("ad_pause_rules").select("*"),
    supabase.from("ad_pause_events").select("*").order("at", { ascending: false }).limit(20),
  ]);
  const canEdit = ctx.role === "super_admin" || ctx.role === "marketing";
  const canRules = canEdit || ctx.role === "ops_manager";
  const inView = (markets ?? []).filter((m) =>
    ctx.markets.some((x) => x.id === m.id && ctx.selected.includes(x.slug)),
  );
  const when = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(iso),
        )
      : t("never");
  const marketName = (id: string | null) =>
    markets?.find((m) => m.id === id)?.name ?? t("unmapped");
  const unmapped = (campaigns ?? []).filter((c) => !c.market_id);
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm">
          <Link href="/marketing" className="underline underline-offset-4">
            {t("back")}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </header>
      {sp.done ? <Alert tone="success" title={t("saved")} /> : null}
      {sp.error ? (
        <Alert
          tone="critical"
          title={t(
            sp.error === "forbidden" ? "forbidden" : sp.error === "sentry" ? "sentry" : "invalid",
          )}
        />
      ) : null}
      <section id="sentry" aria-labelledby="sentry-h" className={card}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 id="sentry-h" className="font-semibold">
            {t("sentryTitle")}
          </h2>
          <Badge tone={sentry.ok ? "success" : "critical"}>
            {t(sentry.ok ? "sentryOn" : "sentryOff")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {sentry.ok ? t("sentryLive") : t("sentryNotLive", { detail: sentry.detail ?? "" })}
        </p>
      </section>
      {sp.test ? (
        <Alert
          tone={sp.test === "ok" ? "success" : "critical"}
          title={t(
            `test.${sp.test === "ok" ? "ok" : sp.test === "missing" ? "missing" : "failed"}`,
          )}
        />
      ) : null}

      <section aria-labelledby="pl-h" className="flex flex-col gap-3">
        <h2 id="pl-h" className="text-lg font-semibold">
          {t("platformsTitle")}
        </h2>
        <ul className="grid gap-3 lg:grid-cols-3">
          {AD_PLATFORMS.map((p) => {
            const c = conns?.find((x) => x.platform === p);
            const status = connectionStatus(p, c?.enabled ?? false, c?.last_error ?? null);
            return (
              <li key={p} id={p} className={card}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{t(`platforms.${p}`)}</h3>
                  <Badge tone={TONE[status]}>{t(`status.${status}`)}</Badge>
                </div>
                <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">{t("account")}</dt>
                  <dd>{c?.account_name ?? "–"}</dd>
                  <dt className="text-muted-foreground">{t("lastSync")}</dt>
                  <dd>{when(c?.last_sync_at ?? null)}</dd>
                  {c?.last_error ? (
                    <>
                      <dt className="text-muted-foreground">{t("lastError")}</dt>
                      <dd className="text-critical-strong">{c.last_error}</dd>
                    </>
                  ) : null}
                </dl>
                {status === "not_connected" ? (
                  <p className="text-sm text-muted-foreground">{t("needKeys")}</p>
                ) : null}
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={testConnectionAction}>
                      <input type="hidden" name="platform" value={p} />
                      <Button type="submit" variant="outline">
                        {t("test.button")}
                      </Button>
                    </form>
                    <form action={setConnectionAction}>
                      <input type="hidden" name="platform" value={p} />
                      <input type="hidden" name="enabled" value={c?.enabled ? "off" : "on"} />
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={!c?.enabled && !sentry.ok}
                        aria-describedby={!c?.enabled && !sentry.ok ? `${p}-sentry` : undefined}
                      >
                        {c?.enabled ? t("turnOff") : t("turnOn")}
                      </Button>
                    </form>
                    {!c?.enabled && !sentry.ok ? (
                      <p id={`${p}-sentry`} className="w-full text-sm text-muted-foreground">
                        {t("sentryBlocked")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section id="codes" className={card} aria-labelledby="codes-h">
        <h2 id="codes-h" className="mb-1 font-semibold">
          {t("codesTitle")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("codesNote")}</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {inView.map((m) => (
            <li key={m.id}>
              <form action={setAdCodeAction} className="flex items-end gap-2">
                <input type="hidden" name="market" value={m.id} />
                <label className={`${label} flex-1`}>
                  {m.name}
                  <input
                    name="code"
                    defaultValue={m.ad_code ?? ""}
                    maxLength={6}
                    className={inputClass}
                    disabled={!canEdit}
                  />
                </label>
                {canEdit ? (
                  <Button type="submit" variant="outline">
                    {t("save")}
                  </Button>
                ) : null}
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section id="campaigns" className={card} aria-labelledby="cp-h">
        <h2 id="cp-h" className="mb-1 font-semibold">
          {t("campaignsTitle")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("campaignsNote", { unmapped: unmapped.length })}
        </p>
        {(campaigns ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCampaigns")}</p>
        ) : (
          <ul className="divide-y">
            {(campaigns ?? []).map((c) => (
              <li key={`${c.platform}:${c.campaign_id}`} className="py-2">
                <form
                  action={mapCampaignAction}
                  className="grid gap-2 sm:grid-cols-[1fr_12rem_12rem_auto] sm:items-end"
                >
                  <input type="hidden" name="platform" value={c.platform} />
                  <input type="hidden" name="campaign" value={c.campaign_id} />
                  <p className="text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-muted-foreground">
                      {t(`platforms.${c.platform as "google_ads"}`)} · {marketName(c.market_id)}
                      {c.mapped_by_hand ? ` · ${t("byHand")}` : ""}
                      {c.paused_by_auto ? ` · ${t("pausedByAuto")}` : ""}
                    </span>
                  </p>
                  <label className={label}>
                    {t("market")}
                    <select
                      name="market"
                      defaultValue={c.market_id ?? ""}
                      className={inputClass}
                      disabled={!canEdit}
                    >
                      <option value="">{t("unmapped")}</option>
                      {inView.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    {t("service")}
                    <select
                      name="service"
                      defaultValue={c.service_slug ?? ""}
                      className={inputClass}
                      disabled={!canEdit}
                    >
                      <option value="">{t("anyService")}</option>
                      {(services ?? []).map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {canEdit ? (
                    <Button type="submit" variant="outline">
                      {t("save")}
                    </Button>
                  ) : null}
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="pause" className={card} aria-labelledby="ps-h">
        <h2 id="ps-h" className="mb-1 font-semibold">
          {t("pauseTitle")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("pauseNote")}</p>
        <ul className="flex flex-col gap-3">
          {inView.map((m) => {
            const r = rules?.find((x) => x.market_id === m.id);
            return (
              <li key={m.id}>
                <form
                  action={setPauseRuleAction}
                  className="flex flex-col gap-3 rounded-xl border p-3"
                >
                  <input type="hidden" name="market" value={m.id} />
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{m.name}</h3>
                    <Badge tone={r?.enabled ? "success" : "neutral"}>
                      {r?.enabled ? t("on") : t("off")}
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-5">
                    <label className="flex min-h-12 items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        name="enabled"
                        defaultChecked={r?.enabled ?? false}
                        className="size-5"
                        disabled={!canRules}
                      />
                      {t("pauseOn")}
                    </label>
                    <label className={label}>
                      {t("minProviders")}
                      <input
                        name="min"
                        type="number"
                        min={1}
                        max={50}
                        defaultValue={r?.min_providers ?? 1}
                        className={inputClass}
                        disabled={!canRules}
                      />
                    </label>
                    <label className={label}>
                      {t("grace")}
                      <input
                        name="grace"
                        type="number"
                        min={0}
                        max={240}
                        defaultValue={r?.grace_minutes ?? 10}
                        className={inputClass}
                        disabled={!canRules}
                      />
                    </label>
                    <label className={label}>
                      {t("startHour")}
                      <input
                        name="start"
                        type="number"
                        min={0}
                        max={23}
                        defaultValue={r?.start_hour ?? 0}
                        className={inputClass}
                        disabled={!canRules}
                      />
                    </label>
                    <label className={label}>
                      {t("endHour")}
                      <input
                        name="end"
                        type="number"
                        min={1}
                        max={24}
                        defaultValue={r?.end_hour ?? 24}
                        className={inputClass}
                        disabled={!canRules}
                      />
                    </label>
                  </div>
                  {canRules ? (
                    <Button type="submit" variant="outline" className="self-start">
                      {t("saveRule")}
                    </Button>
                  ) : null}
                </form>
              </li>
            );
          })}
        </ul>
        {(events ?? []).length ? (
          <>
            <h3 className="mt-4 mb-2 text-sm font-semibold">{t("pauseLog")}</h3>
            <ul className="divide-y text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>
                    {marketName(e.market_id)} · {e.service_slug} ·{" "}
                    {t(e.action === "pause" ? "paused" : "resumed")}
                  </span>
                  <span className="text-muted-foreground">{when(e.at)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </main>
  );
}
