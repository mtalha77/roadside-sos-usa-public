import type { DropRow, Speed, StepRow } from "@rsos/core/booking-metrics";
import { formatNumber, type Locale } from "@rsos/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * Booking speed and funnel panels (RSOS-111), shared by Today, Analytics and Test campaign.
 * Server components; every label comes from `admin.booking`.
 */
const card = "rounded-2xl border bg-card p-4 sm:p-5";

async function fmt() {
  const [t, locale] = await Promise.all([getTranslations("admin.booking"), getLocale()]);
  const l = locale as Locale;
  const count = (n: number) => formatNumber(n, l, { maximumFractionDigits: 0 });
  const pct = (n: number | null) =>
    n === null ? "–" : `${formatNumber(n * 100, l, { maximumFractionDigits: 1 })}%`;
  const secs = (n: number | null) => {
    if (n === null) return "–";
    if (n < 120) return t("sec", { n: Math.round(n) });
    return t("min", { n: formatNumber(n / 60, l, { maximumFractionDigits: 1 }) });
  };
  return { t, count, pct, secs };
}

/** One north-star timing: median and 90th percentile against the target, as text and a mark. */
export async function SpeedValue({ speed }: { speed: Speed }) {
  const { t, secs, count } = await fmt();
  const over = speed.median !== null && speed.median > speed.target;
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{secs(speed.median)}</span>
        <span className="text-sm text-muted-foreground">{t("median")}</span>
      </p>
      <p className="text-sm tabular-nums text-muted-foreground">
        {t("p90", { value: secs(speed.p90) })} · {t("count", { n: count(speed.count) })}
      </p>
      <p
        className={`text-xs font-semibold ${speed.median === null ? "text-muted-foreground" : over ? "text-critical-strong" : "text-success-strong"}`}
      >
        {speed.median === null
          ? t("target", { value: secs(speed.target) })
          : over
            ? t("overTarget", { value: secs(speed.target) })
            : t("underTarget", { value: secs(speed.target) })}
      </p>
    </div>
  );
}

/** A funnel as a list of bars; each row shows its count, conversion and drop-off. */
export async function StepList({
  rows,
  label,
  stepLabel,
}: {
  rows: StepRow[];
  label: string;
  stepLabel: (step: string) => string;
}) {
  const { t, count, pct } = await fmt();
  const first = rows[0]?.count ?? 0;
  return (
    <ol aria-label={label} className="flex flex-col gap-2 text-sm">
      {rows.map((r) => (
        <li
          key={r.step}
          className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 sm:grid-cols-[9rem_minmax(0,1fr)_14rem]"
        >
          <span>{stepLabel(r.step)}</span>
          <span
            aria-hidden="true"
            className="h-4 rounded-full bg-primary/70"
            style={{ width: `${first ? Math.max(1, (r.count / first) * 100) : 1}%` }}
          />
          <span className="col-span-2 text-sm tabular-nums text-muted-foreground sm:col-span-1 sm:text-right sm:text-base sm:text-foreground">
            {count(r.count)}
            {r.conversion !== null
              ? ` · ${pct(r.conversion)} · ${t("dropped", { value: pct(r.dropOff) })}`
              : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A table of groups (market, source, service, device or booking mode) by request step. */
export async function GroupTable({
  caption,
  groups,
  groupLabel,
  keyLabel,
}: {
  caption: string;
  groups: { key: string; rows: StepRow[]; bookedShare: number | null }[];
  groupLabel: string;
  keyLabel: (key: string) => string;
}) {
  const { t, count, pct } = await fmt();
  if (!groups.length) return <p className="text-sm text-muted-foreground">{t("noData")}</p>;
  return (
    <div tabIndex={0} role="group" aria-label={caption} className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th scope="col" className="py-2 font-medium">
              {groupLabel}
            </th>
            {(["submitted", "quoted", "booked", "completed"] as const).map((s) => (
              <th key={s} scope="col" className="py-2 text-right font-medium">
                {t(`steps.${s}`)}
              </th>
            ))}
            <th scope="col" className="py-2 text-right font-medium">
              {t("bookedShare")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {groups.map((g) => (
            <tr key={g.key}>
              <th scope="row" className="py-2 text-left font-normal">
                {keyLabel(g.key)}
              </th>
              {g.rows.map((r) => (
                <td key={r.step} className="py-2 text-right tabular-nums">
                  {count(r.count)}
                </td>
              ))}
              <td className="py-2 text-right font-semibold tabular-nums">{pct(g.bookedShare)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where people drop on the Get Help screens. */
export async function DropTable({ rows }: { rows: DropRow[] }) {
  const { t, count, pct } = await fmt();
  return (
    <div tabIndex={0} role="group" aria-label={t("dropTitle")} className="overflow-x-auto">
      <table className="w-full min-w-[24rem] text-sm">
        <caption className="sr-only">{t("dropTitle")}</caption>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th scope="col" className="py-2 font-medium">
              {t("screen")}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t("reached")}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t("leftShare")}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t("lastField")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.step}>
              <th scope="row" className="py-2 text-left font-normal">
                {t(`screens.${r.step}`)}
              </th>
              <td className="py-2 text-right tabular-nums">{count(r.reached)}</td>
              <td className="py-2 text-right tabular-nums">
                {pct(r.share)} ({count(r.left)})
              </td>
              <td className="py-2 text-right">
                {r.topField
                  ? t.has(`fields.${r.topField}`)
                    ? t(`fields.${r.topField}`)
                    : r.topField
                  : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Panel({
  id,
  title,
  note,
  tag,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  tag?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={card} aria-labelledby={id}>
      <h2 id={id} className="mb-1 flex items-center gap-2 font-semibold">
        {title} {tag}
      </h2>
      {note ? (
        <p className="mb-3 text-xs text-muted-foreground">{note}</p>
      ) : (
        <div className="mb-2" />
      )}
      {children}
    </section>
  );
}
