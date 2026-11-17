import { Badge } from "@rsos/ui/badge";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { getAdminContext } from "@/lib/admin";
import { getServerSupabase } from "@/lib/supabase/server";
import { setA2pAction } from "@/lib/text-settings-actions";
import { TemplateForm } from "./template-form";

const card = "rounded-2xl border bg-card p-4 sm:p-5";
/** Twilio error codes we explain in plain words; others show the number only. */
const KNOWN_ERRORS = [
  21211, 21610, 21614, 30003, 30004, 30005, 30006, 30007, 30008, 30034,
] as const;

/**
 * Settings > Texts (RSOS-035): carrier registration (A2P 10DLC) and the override, the daily
 * delivery report with Twilio error meanings, and the editable SMS templates.
 */
export async function TextsPanel() {
  const [t, ctx, supabase] = await Promise.all([
    getTranslations("admin.settings.texts"),
    getAdminContext(),
    getServerSupabase(),
  ]);
  const [{ data: setting }, { data: report }, { data: templates }] = await Promise.all([
    supabase.from("system_settings").select("value").eq("key", "a2p_10dlc").maybeSingle(),
    supabase.rpc("sms_delivery_report", { p_days: 14 }),
    supabase.from("sms_templates").select("key, title, body_en, body_es, urgent").order("key"),
  ]);
  const a2p = (setting?.value ?? {}) as { status?: string; override?: boolean };
  const status = a2p.status === "approved" || a2p.status === "rejected" ? a2p.status : "pending";
  const market = (id: string) => ctx.markets.find((m) => m.id === id)?.name ?? "";
  const errorText = (code: number) =>
    (KNOWN_ERRORS as readonly number[]).includes(code)
      ? t("errorCode", { code, meaning: t(`twilioErrors.${code}`) })
      : String(code);
  const canEditTemplates = ["super_admin", "ops_manager", "marketing"].includes(ctx.role);
  return (
    <div className="flex flex-col gap-4">
      <section className={card} aria-labelledby="a2p-h">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 id="a2p-h" className="font-semibold">
            {t("a2pTitle")}
          </h2>
          <Badge
            tone={
              status === "approved" ? "success" : status === "rejected" ? "critical" : "warning"
            }
          >
            {t(`a2p.${status}`)}
          </Badge>
          {a2p.override ? <Badge tone="warning">{t("overrideOn")}</Badge> : null}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{t("a2pBody")}</p>
        {ctx.role === "super_admin" ? (
          <form action={setA2pAction} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t("a2pStatus")}
              <select name="status" defaultValue={status} className={inputClass}>
                {(["pending", "approved", "rejected"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`a2p.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-touch items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="override"
                defaultChecked={a2p.override === true}
                className="size-5 accent-[var(--primary)]"
              />
              {t("override")}
            </label>
            <button
              type="submit"
              className="min-h-touch rounded-lg border px-4 text-sm font-medium hover:bg-accent"
            >
              {t("saveA2p")}
            </button>
          </form>
        ) : null}
      </section>

      <section className={card} aria-labelledby="dr-h">
        <h2 id="dr-h" className="mb-3 font-semibold">
          {t("reportTitle")}
        </h2>
        {(report ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reportEmpty")}</p>
        ) : (
          <div tabIndex={0} role="region" aria-labelledby="dr-h" className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left">
                  {(
                    [
                      "day",
                      "market",
                      "sent",
                      "delivered",
                      "failed",
                      "undelivered",
                      "held",
                      "blocked",
                      "received",
                      "errors",
                    ] as const
                  ).map((c) => (
                    <th key={c} scope="col" className="py-2 pr-3 font-medium">
                      {t(`cols.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(report ?? []).map((r) => (
                  <tr key={`${r.day}-${r.market_id}`}>
                    <th scope="row" className="py-2 pr-3 text-left font-normal tabular-nums">
                      {r.day}
                    </th>
                    <td className="py-2 pr-3">{market(r.market_id)}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.sent}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.delivered}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.failed}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.undelivered}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.held}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.blocked}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.received}</td>
                    <td className="py-2 pr-3">
                      {(r.top_errors ?? []).map(errorText).join("; ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={card} aria-labelledby="tpl-h">
        <h2 id="tpl-h" className="mb-1 font-semibold">
          {t("templatesTitle")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("templatesBody")}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {(templates ?? []).map((tpl) => (
            <TemplateForm
              key={tpl.key}
              template={tpl}
              canEdit={canEditTemplates}
              inputClass={inputClass}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
