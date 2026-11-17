import { Badge } from "@rsos/ui/badge";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { getAdminContext } from "@/lib/admin";
import {
  addShiftAction,
  removeShiftAction,
  setMyMobileAction,
  setMyStatusAction,
} from "@/lib/duty-actions";
import { getServerSupabase } from "@/lib/supabase/server";

const card = "rounded-2xl border bg-card p-4 sm:p-5";
const btn = "min-h-touch rounded-lg border px-4 text-sm font-medium hover:bg-accent";
const label = "flex flex-col gap-1 text-sm font-medium";
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Settings > On duty (RSOS-030, 074b): your presence and the "I am on duty now" toggle, your
 * mobile number for fallback rings, who is on duty right now, and the weekly schedule.
 */
export async function OnDuty() {
  const [t, ctx, supabase] = await Promise.all([
    getTranslations("admin.settings.duty"),
    getAdminContext(),
    getServerSupabase(),
  ]);
  const [{ data: staff }, { data: status }, { data: shifts }, { data: now }] = await Promise.all([
    supabase
      .from("staff_members")
      .select("user_id, display_name, role, is_active, mobile_phone")
      .in("role", ["super_admin", "ops_manager", "dispatcher"])
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("dispatcher_status").select("user_id, presence, on_duty_now"),
    supabase
      .from("dispatcher_shifts")
      .select("id, user_id, weekday, start_minute, end_minute, time_zone")
      .order("weekday")
      .order("start_minute"),
    supabase.rpc("on_duty_dispatchers", {}),
  ]);
  const mine = (status ?? []).find((s) => s.user_id === ctx.userId);
  const me = (staff ?? []).find((s) => s.user_id === ctx.userId);
  const isManager = ctx.role === "super_admin" || ctx.role === "ops_manager";
  const canDispatch = isManager || ctx.role === "dispatcher";
  const name = (id: string) => (staff ?? []).find((s) => s.user_id === id)?.display_name ?? "";
  const zones = [...new Set(ctx.markets.map((m) => m.timeZone))];
  const days = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="flex flex-col gap-4">
      {canDispatch ? (
        <section className={card} aria-labelledby="duty-me">
          <h2 id="duty-me" className="mb-3 font-semibold">
            {t("you")}
          </h2>
          <form action={setMyStatusAction} className="flex flex-wrap items-end gap-3">
            <label className={label}>
              {t("presence")}
              <select
                name="presence"
                defaultValue={mine?.presence ?? "away"}
                className={inputClass}
              >
                {(["available", "busy", "away"] as const).map((p) => (
                  <option key={p} value={p}>
                    {t(`presences.${p}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-touch items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="onDuty"
                defaultChecked={mine?.on_duty_now ?? false}
                className="size-5 accent-[var(--primary)]"
              />
              {t("onDutyNow")}
            </label>
            <button type="submit" className={btn}>
              {t("save")}
            </button>
          </form>
          <form action={setMyMobileAction} className="mt-4 flex flex-wrap items-end gap-3">
            <label className={label}>
              {t("mobile")}
              <input
                name="mobile"
                type="tel"
                inputMode="tel"
                defaultValue={me?.mobile_phone ?? ""}
                className={inputClass}
              />
            </label>
            <button type="submit" className={btn}>
              {t("save")}
            </button>
          </form>
          <p className="mt-2 text-sm text-muted-foreground">{t("mobileHint")}</p>
        </section>
      ) : null}

      <section className={card} aria-labelledby="duty-now">
        <h2 id="duty-now" className="mb-3 font-semibold">
          {t("nowTitle")}
        </h2>
        {(now ?? []).length === 0 ? (
          <p role="status" className="text-sm font-medium text-critical-strong">
            {t("nobody")}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {(now ?? []).map((d) => (
              <li
                key={d.user_id}
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
              >
                {name(d.user_id)}
                <Badge
                  tone={
                    d.presence === "available"
                      ? "success"
                      : d.presence === "busy"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {t(`presences.${d.presence}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby="duty-week">
        <h2 id="duty-week" className="mb-3 font-semibold">
          {t("weekTitle")}
        </h2>
        <ul className="flex flex-col divide-y text-sm">
          {days.map((d) => {
            const today = (shifts ?? []).filter((s) => s.weekday === d);
            return (
              <li key={d} className="flex flex-wrap items-start gap-3 py-2">
                <span className="w-28 font-medium">{t(`days.${d}`)}</span>
                {today.length === 0 ? (
                  <span className="font-medium text-critical-strong">{t("uncovered")}</span>
                ) : (
                  <ul className="flex flex-1 flex-wrap gap-2">
                    {today.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 rounded-lg border px-2 py-1"
                      >
                        <span>
                          {t("shift", {
                            name: name(s.user_id),
                            start: hhmm(s.start_minute),
                            end: hhmm(s.end_minute),
                          })}
                        </span>
                        {isManager ? (
                          <form action={removeShiftAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <button
                              type="submit"
                              className="min-h-touch min-w-touch rounded-md px-2 text-muted-foreground hover:bg-accent"
                              aria-label={t("remove", { name: name(s.user_id) })}
                            >
                              {t("removeShort")}
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {isManager ? (
          <form action={addShiftAction} className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <label className={label}>
              {t("who")}
              <select name="userId" required className={inputClass}>
                {(staff ?? []).map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              {t("day")}
              <select name="weekday" className={inputClass}>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {t(`days.${d}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              {t("start")}
              <input
                name="start"
                type="time"
                defaultValue="08:00"
                required
                className={inputClass}
              />
            </label>
            <label className={label}>
              {t("end")}
              <input name="end" type="time" defaultValue="20:00" required className={inputClass} />
            </label>
            <label className={label}>
              {t("zone")}
              <select name="timeZone" className={inputClass}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" className={btn}>
                {t("addShift")}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
