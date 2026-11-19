import {
  callsFunnel,
  dropOff,
  funnelBy,
  mainFunnel,
  northStar,
  northStarBy,
} from "@rsos/core/booking-metrics";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { MetricData } from "@/lib/booking-metrics";
import { DropTable, GroupTable, Panel, SpeedValue, StepList } from "./booking-panels";

const BY = ["market", "source", "service", "device"] as const;
export type FunnelBy = (typeof BY)[number];

/**
 * The booking funnel panels (RSOS-111) for Analytics and Test campaign: the main funnel, Compare
 * quotes vs Instant book, the funnel by market/source/service/device, the calls funnel and where
 * people drop. `byLink` builds the link for each "Funnel by" choice.
 */
export async function BookingAnalytics({
  data,
  by,
  byLink,
  tag,
  names,
  calls = true,
}: {
  data: MetricData;
  by: FunnelBy;
  byLink: (by: FunnelBy) => string;
  tag?: ReactNode;
  names: {
    market: (slug: string) => string;
    source: (s: string) => string;
    service: (s: string) => string;
  };
  calls?: boolean;
}) {
  const t = await getTranslations("admin.booking");
  const keyLabel = (key: string) =>
    by === "market"
      ? names.market(key)
      : by === "source"
        ? names.source(key)
        : by === "service"
          ? names.service(key)
          : t(`devices.${key === "mobile" || key === "desktop" ? key : "unknown"}`);
  const chip =
    "inline-flex min-h-12 items-center rounded-full border px-4 text-sm aria-[current=page]:border-primary aria-[current=page]:bg-primary/10";
  return (
    <>
      <Panel id="bf-h" title={t("funnelTitle")} note={t("funnelNote")} tag={tag}>
        <StepList
          rows={mainFunnel(data.requests, data.events, data.visits)}
          label={t("funnelTitle")}
          stepLabel={(s) => t(`steps.${s}` as never)}
        />
      </Panel>
      <Panel id="bm-h" title={t("modeTitle")} tag={tag}>
        <GroupTable
          caption={t("modeTitle")}
          groups={funnelBy(data.requests, "mode")}
          groupLabel={t("group")}
          keyLabel={(k) => t(`modes.${k === "instant" ? "instant" : "compare"}`)}
        />
      </Panel>
      <Panel id="bb-h" title={t("byTitle")} tag={tag}>
        <nav aria-label={t("byTitle")} className="mb-3 flex flex-wrap gap-2">
          {BY.map((b) => (
            <a
              key={b}
              href={byLink(b)}
              aria-current={b === by ? "page" : undefined}
              className={chip}
            >
              {t(`by.${b}`)}
            </a>
          ))}
        </nav>
        <GroupTable
          caption={`${t("byTitle")} ${t(`by.${by}`)}`}
          groups={funnelBy(data.requests, by)}
          groupLabel={t(`by.${by}`)}
          keyLabel={keyLabel}
        />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {calls ? (
          <Panel id="bc-h" title={t("callsTitle")} note={t("callsNote")} tag={tag}>
            <StepList
              rows={callsFunnel(data.calls)}
              label={t("callsTitle")}
              stepLabel={(s) => t(`callSteps.${s}` as never)}
            />
          </Panel>
        ) : null}
        <Panel id="bd-h" title={t("dropTitle")} note={t("dropNote")} tag={tag}>
          <DropTable rows={dropOff(data.events)} />
        </Panel>
      </div>
    </>
  );
}

/** Today's booking speed (RSOS-111): both north-star timings, today and the last 7 days. */
export async function BookingSpeed({
  data,
  now,
  dayStart,
  tag,
  names,
  toggle,
}: {
  data: MetricData;
  now: number;
  dayStart: number;
  tag?: ReactNode;
  names: { market: (slug: string) => string; source: (s: string) => string };
  toggle?: ReactNode;
}) {
  const t = await getTranslations("admin.booking");
  const week = now - 7 * 86_400_000;
  const periods = [
    ["today", northStar(data.requests, dayStart, now + 1)],
    ["last7", northStar(data.requests, week, now + 1)],
  ] as const;
  const groups = [
    ["byMarket", northStarBy(data.requests, "market", week, now + 1), names.market],
    ["bySource", northStarBy(data.requests, "source", week, now + 1), names.source],
  ] as const;
  return (
    <Panel id="speed-h" title={t("speedTitle")} note={t("speedNote")} tag={tag}>
      {toggle}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["landingToSubmit", "submitToBooked"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-3 rounded-xl border p-3">
            <h3 className="text-sm font-semibold">{t(k)}</h3>
            <div className="grid grid-cols-2 gap-3">
              {periods.map(([p, s]) => (
                <div key={p} className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">{t(p)}</p>
                  <SpeedValue speed={s[k]} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {groups.map(([g, rows, name]) => (
          <div
            key={g}
            tabIndex={0}
            role="group"
            aria-label={`${t(g)} · ${t("last7")}`}
            className="overflow-x-auto"
          >
            <table className="w-full text-sm">
              <caption className="mb-1 text-left text-xs font-semibold text-muted-foreground">
                {t(g)} · {t("last7")}
              </caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-1.5 font-medium">
                    {t("group")}
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    {t("landingToSubmit")}
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    {t("submitToBooked")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length ? (
                  rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row" className="py-1.5 text-left font-normal">
                        {name(r.key)}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.landingToSubmit.median === null
                          ? "–"
                          : t("sec", { n: r.landingToSubmit.median })}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.submitToBooked.median === null
                          ? "–"
                          : r.submitToBooked.median < 120
                            ? t("sec", { n: r.submitToBooked.median })
                            : t("min", { n: Math.round(r.submitToBooked.median / 6) / 10 })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-2 text-muted-foreground">
                      {t("noData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Panel>
  );
}
