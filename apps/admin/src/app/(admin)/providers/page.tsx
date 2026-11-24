import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { EmptyState } from "@rsos/ui/empty-state";
import { inputClass } from "@rsos/ui/input";
import { LiteMap } from "@rsos/ui/lite-map";
import { ProviderLogo } from "@rsos/ui/provider-logo";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { DocumentReview } from "@/components/providers/document-review";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { demoDocuments, listProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";
const TABS = ["table", "map", "review"] as const;
/** Rows per page of the table (the list grows with every market). */
const PAGE_SIZE = 50;

async function load(q: string) {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  const rows = await listProviders({
    markets: ctx.selected,
    marketIds: Object.fromEntries(ctx.markets.map((m) => [m.slug, m.id])),
    q,
    demo: ctx.demo,
  });
  return { ctx, now, rows };
}

/**
 * Providers (RSOS-075): table with filters, map view, and the document review queue with
 * documents side by side and approve or request changes. Detail pages hold the actions.
 */
export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = TABS.find((x) => x === sp.tab) ?? "table";
  const status = sp.status ?? "";
  const [t, { ctx, now, rows: all }] = await Promise.all([
    getTranslations("admin.providers"),
    load(sp.q ?? ""),
  ]);
  const rows = status ? all.filter((r) => r.status === status) : all;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageNum = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const pageRows = rows.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") q.set(k, v);
    if (n > 1) q.set("page", String(n));
    const qs = q.toString();
    return qs ? `/providers?${qs}` : "/providers";
  };
  const markets = Object.fromEntries(ctx.markets.map((m) => [m.slug, m.name]));
  const queue = all.filter((r) => r.demo && r.status === "onboarding");
  const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <nav aria-label={t("views")} className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((x) => (
          <Link
            key={x}
            href={`/providers?tab=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className="flex min-h-12 shrink-0 items-center border-b-2 border-transparent px-4 font-medium aria-[current=page]:border-primary"
          >
            {t(`tabs.${x}`)}
            {x === "review" && queue.length ? ` (${queue.length})` : ""}
          </Link>
        ))}
      </nav>
      {tab === "review" ? (
        queue.length === 0 ? (
          <EmptyState title={t("queueEmpty")} />
        ) : (
          <DocumentReview
            items={queue.map((p) => ({
              id: p.id,
              name: p.name,
              market: markets[p.markets[0] ?? ""] ?? "",
              docs: demoDocuments(p.id, now).map((d) => ({
                kind: t(`docs.${d.kind}`),
                expires: date.format(d.expires),
                state: d.state,
              })),
            }))}
            labels={{
              approve: t("approve"),
              changes: t("changes"),
              approved: t("approved"),
              requested: t("requested"),
              expires: t("expires"),
              preview: t("preview"),
              reason: t("reason"),
              states: t("states.ok") + "|" + t("states.pending") + "|" + t("states.expiring"),
            }}
          />
        )
      ) : (
        <>
          <form role="search" className="flex flex-wrap gap-2">
            <input type="hidden" name="tab" value={tab} />
            <label htmlFor="pq" className="sr-only">
              {t("search")}
            </label>
            <input
              id="pq"
              name="q"
              type="search"
              defaultValue={sp.q ?? ""}
              placeholder={t("search")}
              className={`${inputClass} max-w-xs`}
            />
            <label htmlFor="ps" className="sr-only">
              {t("status")}
            </label>
            <select
              id="ps"
              name="status"
              defaultValue={status}
              className={`${inputClass} max-w-48`}
            >
              <option value="">{t("allStatuses")}</option>
              {["applied", "onboarding", "active", "paused", "suspended", "closed"].map((s) => (
                <option key={s} value={s}>
                  {t(`statuses.${s}`)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              {t("filter")}
            </Button>
          </form>
          {rows.length === 0 ? (
            <EmptyState title={t("none")} />
          ) : tab === "map" ? (
            <LiteMap
              label={t("tabs.map")}
              points={rows
                .filter((r) => r.lat !== null)
                .map((r) => ({
                  id: r.id,
                  lat: r.lat!,
                  lng: r.lng!,
                  kind: "provider" as const,
                  label: r.name,
                }))}
            />
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-label={t("title")}
              className="overflow-x-auto rounded-2xl border bg-card"
            >
              <table className="w-full min-w-[56rem] text-sm">
                <caption className="sr-only">{t("title")}</caption>
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("name")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("status")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("market")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("trucks")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("rating")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("online")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("responseRate")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("medianQuote")}
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      {t("bookingRate")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageRows.map((r) => (
                    <tr key={r.id} className="hover:bg-accent">
                      <th scope="row" className="px-4 py-2 text-left font-semibold">
                        <Link
                          href={`/providers/${encodeURIComponent(r.id)}`}
                          prefetch={false}
                          className="inline-flex min-h-12 items-center gap-2 underline-offset-2 hover:underline"
                        >
                          {r.logo ? <ProviderLogo logo={r.logo} size={28} /> : null}
                          {r.name}
                        </Link>{" "}
                        {r.demo ? null : <Badge tone="info">{t("real")}</Badge>}
                      </th>
                      <td className="px-4 py-2">{t(`statuses.${r.status}`)}</td>
                      <td className="px-4 py-2">
                        {r.markets.map((m) => markets[m] ?? m).join(", ")}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{r.trucks ?? "—"}</td>
                      <td className="px-4 py-2 tabular-nums">{r.rating?.toFixed(1) ?? "—"}</td>
                      <td className="px-4 py-2">
                        {r.online === null ? "—" : r.online ? t("onlineYes") : t("onlineNo")}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{pct(r.responseRate)}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {r.medianQuoteSec === null ? "—" : t("seconds", { s: r.medianQuoteSec })}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{pct(r.bookingRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "table" && pages > 1 ? (
            <nav aria-label={t("pagination")} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground" aria-live="polite">
                {t("pageOf", {
                  from: (pageNum - 1) * PAGE_SIZE + 1,
                  to: Math.min(pageNum * PAGE_SIZE, rows.length),
                  total: rows.length,
                })}
              </span>
              {pageNum > 1 ? (
                <Link
                  href={pageHref(pageNum - 1)}
                  className="inline-flex min-h-12 items-center underline underline-offset-4"
                >
                  {t("prevPage")}
                </Link>
              ) : null}
              {pageNum < pages ? (
                <Link
                  href={pageHref(pageNum + 1)}
                  className="inline-flex min-h-12 items-center underline underline-offset-4"
                >
                  {t("nextPage")}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
