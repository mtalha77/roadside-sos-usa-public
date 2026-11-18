import { formatCurrency, type Locale } from "@rsos/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { card, PageHead, pageMain } from "@/components/shell/page-head";
import { TakeTourButton } from "@/components/tours/portal-tour";
import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

const TABS = ["active", "won", "lost", "cancelled"] as const;
/** Technicians see only what is theirs to do and what they finished (RSOS-104). */
const TECH_TABS = ["active", "won"] as const;
const PAGE = 20;

async function load() {
  const ctx = await getPortalContext();
  return { ctx, ...(await getPortalData(ctx, Date.now())) };
}

/** Jobs (RSOS-056): Active, Won, Lost or missed, Cancelled; service filter; paged list. */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [t, tt, ts, locale, { ctx, data, pricing }] = await Promise.all([
    getTranslations("portal.jobs"),
    getTranslations("tours.labels"),
    getTranslations("site.services"),
    getLocale(),
    load(),
  ]);
  const tech = ctx.role === "operator";
  const tabs: readonly (typeof TABS)[number][] = tech ? TECH_TABS : TABS;
  const tab = tabs.find((x) => x === sp.tab) ?? "active";
  const current = tech ? data.activeJobs[0] : undefined;
  const svc = sp.service ?? "";
  const all = tab === "active" ? data.activeJobs : data.history.filter((j) => j.status === tab);
  const list = all.filter((j) => !svc || j.serviceSlug === svc);
  const shown = Math.min(list.length, Number(sp.n ?? PAGE));
  const name = (s: string) => (ts.has(`${s}.name`) ? ts(`${s}.name`) : s);
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <main id="main" className={pageMain}>
      <PageHead
        title={tech ? t("mine") : t("title")}
        action={
          tech ? (
            <TakeTourButton
              tour="provider.operator"
              label={tt("take")}
              className="inline-flex min-h-touch items-center gap-2 rounded-lg border px-3 font-medium hover:bg-accent"
            />
          ) : undefined
        }
      />
      {current ? (
        <Link
          href={`/jobs/${encodeURIComponent(current.id)}/active`}
          data-tour="tech-active"
          className="flex flex-col gap-1 rounded-2xl border-2 border-primary bg-card p-4 hover:bg-accent"
        >
          <span className="text-sm font-medium text-muted-foreground">{t("activeNow")}</span>
          <span className="text-xl font-semibold">
            {name(current.serviceSlug)} · {current.area}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">{current.code}</span>
          <span className="mt-2 inline-flex min-h-touch items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            {t("openActive")}
          </span>
        </Link>
      ) : null}
      <nav aria-label={t("title")} className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((x) => (
          <Link
            key={x}
            href={`/jobs?tab=${x}${svc ? `&service=${svc}` : ""}`}
            aria-current={x === tab ? "page" : undefined}
            className="inline-flex min-h-touch items-center border-b-2 border-transparent px-3 font-medium whitespace-nowrap aria-[current=page]:border-primary"
          >
            {tech && x === "won" ? t("tabs.done") : t(`tabs.${x}`)}
          </Link>
        ))}
      </nav>
      <form className={tech ? "hidden" : "flex flex-wrap items-end gap-2"}>
        <input type="hidden" name="tab" value={tab} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("filter")}
          <select
            name="service"
            defaultValue={svc}
            className="min-h-touch rounded-lg border border-input bg-surface px-3"
          >
            <option value="">{t("all")}</option>
            {pricing
              .filter((p) => p.enabled)
              .map((p) => (
                <option key={p.service_slug} value={p.service_slug}>
                  {name(p.service_slug)}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className="min-h-touch rounded-lg border px-4 font-medium">
          {t("filter")}
        </button>
      </form>
      {list.length === 0 ? (
        <p className={card}>{t("none")}</p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {list.slice(0, shown).map((j) => (
            <li key={j.id + j.at}>
              <Link
                href={`/jobs/${encodeURIComponent(j.id)}?at=${j.at}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-accent"
              >
                <div>
                  <p className="font-medium">
                    {name(j.serviceSlug)} · {j.area}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {j.code} · {date.format(j.at)} · {j.operator}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold">{money(j.priceCents)}</p>
                  {ctx.canSeeMoney && j.feeCents ? (
                    <p className="text-sm text-muted-foreground">
                      {t("fee", { fee: money(j.feeCents) })}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {shown < list.length ? (
        <Link
          href={`/jobs?tab=${tab}${svc ? `&service=${svc}` : ""}&n=${shown + PAGE}`}
          className="inline-flex min-h-touch items-center self-center rounded-lg border px-5 font-medium"
          scroll={false}
        >
          {t("more")}
        </Link>
      ) : null}
    </main>
  );
}
