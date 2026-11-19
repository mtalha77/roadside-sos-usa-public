import { COMMON_QUESTIONS, questionsFor, SERVICE_QUESTIONS } from "@rsos/core/service-questions";
import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { setQuestionAction } from "@/lib/service-actions";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const card = "rounded-2xl border bg-card p-4 sm:p-5";

/**
 * Admin > Business > Services (RSOS-116): the Get Help questions per service, and per market
 * (or every market) which are hidden, required or optional, and their order. "Are you in a safe
 * place?" is always asked. Every change is in the audit log.
 */
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [t, tq, ctx, sp] = await Promise.all([
    getTranslations("admin.servicesForm"),
    getTranslations("getHelp.q"),
    getAdminContext(),
    searchParams,
  ]);
  const supabase = await getServerSupabase();
  const [{ data: services }, { data: rows }] = await Promise.all([
    supabase.from("services").select("slug, name").order("sort_order"),
    supabase
      .from("service_question_overrides")
      .select("market_id, service_slug, question_id, hidden, required, sort"),
  ]);
  const list = (services ?? []).filter((s) => SERVICE_QUESTIONS[s.slug]);
  const service = list.find((s) => s.slug === sp.service)?.slug ?? list[0]?.slug ?? "tow";
  const markets = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const market =
    sp.market === "all" || !sp.market
      ? "all"
      : (markets.find((m) => m.id === sp.market)?.id ?? "all");
  const canEdit = ctx.role === "super_admin" || (ctx.role === "ops_manager" && market !== "all");
  const mine = (rows ?? []).filter(
    (r) =>
      r.service_slug === service &&
      (market === "all" ? r.market_id === null : r.market_id === market),
  );
  const overrides = mine.map((r) => ({
    service: r.service_slug,
    questionId: r.question_id,
    hidden: r.hidden,
    required: r.required,
    sort: r.sort,
  }));
  const shown = new Set(questionsFor(service, overrides).map((q) => q.id));
  const all = [...COMMON_QUESTIONS, ...(SERVICE_QUESTIONS[service] ?? [])];
  const chip =
    "inline-flex min-h-12 items-center rounded-full border px-4 text-sm aria-[current=page]:border-primary aria-[current=page]:bg-primary/10";
  const href = (patch: Record<string, string>) =>
    `/services?${new URLSearchParams({ market, service, ...patch }).toString()}`;
  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </header>
      {sp.done ? <Alert tone="success" title={t("saved")} /> : null}
      {sp.error ? <Alert tone="critical" title={t("error")} /> : null}
      <nav aria-label={t("market")} className="flex flex-wrap gap-2">
        <Link
          href={href({ market: "all" })}
          aria-current={market === "all" ? "page" : undefined}
          className={chip}
        >
          {t("allMarkets")}
        </Link>
        {markets.map((m) => (
          <Link
            key={m.id}
            href={href({ market: m.id })}
            aria-current={market === m.id ? "page" : undefined}
            className={chip}
          >
            {m.name}
          </Link>
        ))}
      </nav>
      <nav aria-label={t("service")} className="flex flex-wrap gap-2">
        {list.map((s) => (
          <Link
            key={s.slug}
            href={href({ service: s.slug })}
            aria-current={s.slug === service ? "page" : undefined}
            className={chip}
          >
            {s.name}
          </Link>
        ))}
      </nav>
      {!canEdit ? (
        <Alert tone="info" title={t(market === "all" ? "ownerOnly" : "viewOnly")} />
      ) : null}
      <ol className="flex flex-col gap-3">
        {all.map((q) => {
          const o = overrides.find((x) => x.questionId === q.id);
          return (
            <li key={q.id} id={`q-${q.id}`} className={card}>
              <form action={setQuestionAction} className="flex flex-col gap-3">
                <input type="hidden" name="market" value={market} />
                <input type="hidden" name="service" value={service} />
                <input type="hidden" name="question" value={q.id} />
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{tq(`${q.id}.label` as never)}</h2>
                  <Badge tone={shown.has(q.id) ? "success" : "neutral"}>
                    {shown.has(q.id) ? t("shown") : t("hidden")}
                  </Badge>
                  <Badge tone="outline">
                    {q.required ? t("requiredDefault") : t("optionalDefault")}
                  </Badge>
                  {COMMON_QUESTIONS.includes(q) ? <Badge tone="info">{t("common")}</Badge> : null}
                </div>
                {q.options ? (
                  <p className="text-sm text-muted-foreground">
                    {q.options.map((x) => tq(`${q.id}.options.${x}` as never)).join(" · ")}
                  </p>
                ) : null}
                {q.id === "safety" ? (
                  <p className="text-sm text-muted-foreground">{t("safetyAlways")}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[auto_12rem_8rem_auto] sm:items-end">
                    <label className="flex min-h-12 items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        name="hidden"
                        defaultChecked={o?.hidden ?? false}
                        className="size-5"
                        disabled={!canEdit}
                      />
                      {t("hide")}
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {t("required")}
                      <select
                        name="required"
                        defaultValue={
                          o?.required === null || o?.required === undefined
                            ? "default"
                            : o.required
                              ? "yes"
                              : "no"
                        }
                        className={inputClass}
                        disabled={!canEdit}
                      >
                        <option value="default">{t("asDesigned")}</option>
                        <option value="yes">{t("requiredYes")}</option>
                        <option value="no">{t("requiredNo")}</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                      {t("order")}
                      <input
                        name="sort"
                        type="number"
                        min={-100}
                        max={100}
                        defaultValue={o?.sort ?? ""}
                        className={inputClass}
                        disabled={!canEdit}
                      />
                    </label>
                    {canEdit ? (
                      <Button type="submit" variant="outline">
                        {t("save")}
                      </Button>
                    ) : null}
                  </div>
                )}
              </form>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
