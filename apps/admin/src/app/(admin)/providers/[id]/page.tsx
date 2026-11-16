import { demoPortal } from "@rsos/core/demo";
import { formatCurrency, type Locale } from "@rsos/i18n";
import { Badge } from "@rsos/ui/badge";
import { LiteMap } from "@rsos/ui/lite-map";
import { StatCard } from "@rsos/ui/stat-card";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProviderActions } from "@/components/providers/provider-actions";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { demoDocuments, demoProviderFromId } from "@/lib/providers";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const card = "rounded-2xl border bg-card p-4 sm:p-5";

async function load(id: string) {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  const demo = ctx.demo ? demoProviderFromId(id) : null;
  if (demo) {
    const portal = demoPortal(now, { marketSlug: demo.marketSlug, providerSlug: demo.slug });
    return { now, kind: "demo" as const, demo, portal, real: null };
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("providers")
    .select("id, name, status, status_reason")
    .eq("id", id)
    .maybeSingle();
  return data ? { now, kind: "real" as const, demo: null, portal: null, real: data } : null;
}

/**
 * Provider detail (RSOS-075): company, team, trucks, area, documents, performance, wallet,
 * reviews, notes and activity, with actions (approve, pause, suspend, credit, message, view as).
 */
export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, locale, data] = await Promise.all([
    getTranslations("admin.providers"),
    getLocale(),
    load(decodeURIComponent(id)),
  ]);
  if (!data) notFound();
  const money = (c: number) => formatCurrency(c, locale as Locale);
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
  });
  const name = data.demo?.name ?? data.real?.name ?? "";
  const status = data.real?.status ?? "active";
  const actions = (
    <ProviderActions
      labels={Object.fromEntries(
        [
          "actions",
          "approve",
          "pause",
          "suspend",
          "credit",
          "message",
          "viewAs",
          "done",
          "note",
          "addNote",
        ].map((k) => [k, t(`act.${k}`)]),
      )}
    />
  );
  if (data.kind === "real")
    return (
      <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{name}</h1>
          <Badge tone="info">{t(`statuses.${status}`)}</Badge>
          <Badge tone="info">{t("real")}</Badge>
        </header>
        {data.real?.status_reason ? (
          <p className="text-muted-foreground">{data.real.status_reason}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{t("realPending")}</p>
        {actions}
      </main>
    );
  const p = data.portal!;
  const won = p.history.filter((j) => j.status === "won");
  const docs = demoDocuments(id, data.now);
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <Badge tone="success">{t(`statuses.${status}`)}</Badge>
        <Badge tone="outline">{t("demo")}</Badge>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("jobsWon")} value={String(won.length)} />
        <StatCard label={t("rating")} value={p.provider.rating?.toFixed(1) ?? "—"} />
        <StatCard label={t("trucks")} value={String(p.provider.trucks)} />
        <StatCard label={t("feesPaid")} value={money(won.reduce((a, j) => a + j.feeCents, 0))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <section className={card} aria-labelledby="team-h">
            <h2 id="team-h" className="mb-2 font-semibold">
              {t("team")}
            </h2>
            <ul className="divide-y text-sm">
              {p.team.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 py-2">
                  <span>
                    {m.name} · {t(`roles.${m.role}`)}
                  </span>
                  <span className="text-muted-foreground">{m.truck}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={card} aria-labelledby="area-h">
            <h2 id="area-h" className="mb-2 font-semibold">
              {t("area")}
            </h2>
            <LiteMap
              label={t("area")}
              points={[{ id: "base", ...p.provider.home, kind: "provider", label: name }]}
              radius={{ center: p.provider.home, miles: 20 }}
            />
          </section>
          <section className={card} aria-labelledby="docs-h">
            <h2 id="docs-h" className="mb-2 font-semibold">
              {t("documents")}
            </h2>
            <ul className="divide-y text-sm">
              {docs.map((d) => (
                <li key={d.kind} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{t(`docs.${d.kind}`)}</span>
                  <span className="text-muted-foreground">
                    {t("expires")} {date.format(d.expires)} · {t(`states.${d.state}`)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className={card} aria-labelledby="jobs-h">
            <h2 id="jobs-h" className="mb-2 font-semibold">
              {t("recent")}
            </h2>
            <ul className="divide-y text-sm">
              {p.history.slice(0, 8).map((j) => (
                <li key={j.id + j.at} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {j.code} · {j.area}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {money(j.priceCents)} · {date.format(j.at)}
                    {j.rating ? ` · ★ ${j.rating}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="flex flex-col gap-4">{actions}</div>
      </div>
    </main>
  );
}
