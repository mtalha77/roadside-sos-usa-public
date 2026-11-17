import { coverageTarget } from "@rsos/config/demo-fixtures";
import { Progress } from "@rsos/ui/progress";
import { getTranslations } from "next-intl/server";
import { Pipeline } from "@/components/recruitment/pipeline";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { listLeads, STAGES } from "@/lib/recruitment";

export const dynamic = "force-dynamic";

async function load() {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  const leads = await listLeads({
    markets: ctx.selected,
    marketIds: Object.fromEntries(ctx.markets.map((m) => [m.slug, m.id])),
    demo: ctx.demo,
    now,
  });
  return { ctx, leads };
}

/**
 * Recruitment (RSOS-076): board and table per market (lead, contacted, interested, onboarding,
 * live, lost); real leads from provider applications plus demo ones; CSV import; tasks and
 * reminders; coverage target progress per market.
 */
export default async function RecruitmentPage() {
  const [t, { ctx, leads }] = await Promise.all([getTranslations("admin.recruitment"), load()]);
  const inView = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <section aria-labelledby="cov-h" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <h2 id="cov-h" className="sr-only">
          {t("coverage")}
        </h2>
        {inView.map((m) => {
          const live = leads.filter((l) => l.market === m.slug && l.stage === "live").length;
          return (
            <div key={m.slug} className="rounded-2xl border bg-card p-4">
              <p className="font-semibold">{m.name}</p>
              <p className="mb-2 text-sm text-muted-foreground">
                {t("coverageOf", { live, target: coverageTarget })}
              </p>
              <Progress
                value={Math.min(100, Math.round((live / coverageTarget) * 100))}
                label={`${t("coverage")} ${m.name}`}
              />
            </div>
          );
        })}
      </section>
      <Pipeline
        leads={leads}
        stages={STAGES.map((s) => ({ id: s, label: t(`stages.${s}`) }))}
        markets={Object.fromEntries(ctx.markets.map((m) => [m.slug, m.name]))}
        labels={Object.fromEntries(
          [
            "board",
            "table",
            "view",
            "company",
            "contact",
            "market",
            "stage",
            "trucks",
            "source",
            "task",
            "followUp",
            "remind",
            "reminded",
            "approve",
            "approvedNotice",
            "approveFailed",
            "import",
            "importHint",
            "imported",
            "importError",
            "demo",
            "real",
            "moveTo",
            "empty",
          ].map((k) => [k, String(t.raw(k))]),
        )}
      />
    </main>
  );
}
