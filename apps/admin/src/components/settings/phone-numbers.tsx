import { TRACKING_SOURCES } from "@rsos/core/adapters";
import { Badge } from "@rsos/ui/badge";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { getAdminContext } from "@/lib/admin";
import { setNumberActiveAction } from "@/lib/phone-actions";
import { getServerSupabase } from "@/lib/supabase/server";
import { AddNumberForm, SyncNumbersButton } from "./phone-number-forms";

const card = "rounded-2xl border bg-card p-4 sm:p-5";

/**
 * Settings > Phone numbers (RSOS-030): every tracking number with its market and source. Super
 * admins and ops managers add, deactivate and sync them; numbers are bought in Twilio.
 */
export async function PhoneNumbers() {
  const [t, ctx, supabase] = await Promise.all([
    getTranslations("admin.settings.phones"),
    getAdminContext(),
    getServerSupabase(),
  ]);
  const { data: numbers } = await supabase
    .from("market_phone_numbers")
    .select("id, phone_number, purpose, label, is_active, twilio_sid, synced_at, market_id")
    .order("created_at");
  const marketName = (id: string) => ctx.markets.find((m) => m.id === id)?.name ?? "";
  const canEdit = ctx.role === "super_admin" || ctx.role === "ops_manager";
  const sources = TRACKING_SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) }));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <section className={card} aria-labelledby="pn-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="pn-h" className="font-semibold">
            {t("title")}
          </h2>
          {canEdit ? <SyncNumbersButton /> : null}
        </div>
        {(numbers ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div tabIndex={0} role="region" aria-labelledby="pn-h" className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t("number")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t("market")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t("source")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t("status")}
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    <span className="sr-only">{t("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(numbers ?? []).map((n) => (
                  <tr key={n.id}>
                    <th scope="row" className="py-2 pr-3 text-left font-mono font-normal">
                      {n.phone_number}
                      {n.label ? (
                        <span className="block font-sans text-muted-foreground">{n.label}</span>
                      ) : null}
                    </th>
                    <td className="py-2 pr-3">{marketName(n.market_id)}</td>
                    <td className="py-2 pr-3">{t(`sources.${n.purpose}`)}</td>
                    <td className="py-2 pr-3">
                      <span className="flex flex-wrap gap-1">
                        <Badge tone={n.is_active ? "success" : "neutral"}>
                          {n.is_active ? t("active") : t("inactive")}
                        </Badge>
                        {n.twilio_sid ? <Badge tone="info">{t("inTwilio")}</Badge> : null}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {canEdit ? (
                        <form action={setNumberActiveAction}>
                          <input type="hidden" name="id" value={n.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={n.is_active ? "false" : "true"}
                          />
                          <button
                            type="submit"
                            className="min-h-touch rounded-lg border px-3 font-medium hover:bg-accent"
                          >
                            {n.is_active ? t("deactivate") : t("activate")}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {canEdit ? (
        <section className={card} aria-labelledby="pn-add">
          <h2 id="pn-add" className="mb-3 font-semibold">
            {t("add")}
          </h2>
          <AddNumberForm
            markets={ctx.markets.map((m) => ({ value: m.slug, label: m.name }))}
            sources={sources}
            inputClass={inputClass}
          />
        </section>
      ) : null}
      <section className={card} aria-labelledby="pn-setup">
        <h2 id="pn-setup" className="mb-2 font-semibold">
          {t("setupTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("setupBody")}</p>
      </section>
    </div>
  );
}
