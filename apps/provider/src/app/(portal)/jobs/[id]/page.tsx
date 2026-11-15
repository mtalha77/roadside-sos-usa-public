import { formatCurrency, type Locale } from "@rsos/i18n";
import { Button } from "@rsos/ui/button";
import { Timeline } from "@rsos/ui/timeline";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { card, PageHead, pageMain } from "@/components/shell/page-head";
import { DisputeButton } from "@/components/jobs/dispute-button";
import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const ctx = await getPortalContext();
  const { data } = await getPortalData(ctx, Date.now());
  return { ctx, job: [...data.activeJobs, ...data.history].find((j) => j.id === id) ?? null };
}

/** Job detail (RSOS-056): timeline, price, fee, driver and vehicle, photos, review, fee dispute. */
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, ts, locale, { ctx, job }] = await Promise.all([
    getTranslations("portal.job"),
    getTranslations("site.services"),
    getLocale(),
    load(decodeURIComponent(id)),
  ]);
  if (!job) notFound();
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const time = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const steps =
    job.status === "cancelled"
      ? ["quoting", "cancelled"]
      : job.status === "lost"
        ? ["quoting"]
        : ["quoting", "picked", "en_route", "on_site", "completed"];
  const offsets = [1, 4, 5, 18, 34];
  return (
    <main id="main" className={pageMain}>
      <PageHead
        title={t("title", { code: job.code })}
        subtitle={`${ts.has(`${job.serviceSlug}.name`) ? ts(`${job.serviceSlug}.name`) : job.serviceSlug} · ${job.area}`}
        action={
          job.status === "active" ? (
            <Button asChild>
              <Link href={`/jobs/${encodeURIComponent(job.id)}/active`} prefetch={false}>
                {t("activeFlow")}
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <section className={card} aria-labelledby="tl-h">
          <h2 id="tl-h" className="mb-3 font-semibold">
            {t("timeline")}
          </h2>
          <Timeline
            items={steps.map((s, i) => ({
              id: s,
              title: t(`stages.${s}`),
              time: time.format(job.at + (offsets[i] ?? i) * 60_000),
              tone: s === "cancelled" ? "critical" : "success",
            }))}
          />
        </section>
        <section className={card}>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-muted-foreground">{t("price")}</dt>
            <dd className="text-right font-semibold tabular-nums">{money(job.priceCents)}</dd>
            {ctx.canSeeMoney ? (
              <>
                <dt className="text-muted-foreground">{t("fee")}</dt>
                <dd className="text-right tabular-nums">{money(job.feeCents)}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">{t("driver")}</dt>
            <dd className="text-right">{job.driverName}</dd>
            <dt className="text-muted-foreground">{t("vehicle")}</dt>
            <dd className="text-right">{job.vehicle}</dd>
            <dt className="text-muted-foreground">{t("operator")}</dt>
            <dd className="text-right">{job.operator}</dd>
          </dl>
          <h2 className="mt-4 mb-1 font-semibold">{t("review")}</h2>
          <p className="text-muted-foreground">
            {job.rating ? "★".repeat(job.rating) : t("noReview")}
          </p>
          <h2 className="mt-4 mb-1 font-semibold">{t("photos")}</h2>
          <p className="text-muted-foreground">{t("noPhotos")}</p>
          {ctx.canSeeMoney && job.feeCents ? (
            <DisputeButton label={t("dispute")} sent={t("disputeSent")} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
