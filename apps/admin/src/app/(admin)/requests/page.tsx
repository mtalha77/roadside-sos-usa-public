import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { EmptyState } from "@rsos/ui/empty-state";
import { inputClass } from "@rsos/ui/input";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { listRequests } from "@/lib/requests";

export const dynamic = "force-dynamic";

async function load(q: string) {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  return { ctx, rows: await listRequests({ q, markets: ctx.selected, demo: ctx.demo, now }) };
}

/** Requests (RSOS-073): search by code, phone or name; each opens the full request page. */
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const [t, ts, locale, { ctx, rows }] = await Promise.all([
    getTranslations("admin.requests"),
    getTranslations("site.services"),
    getLocale(),
    load(q),
  ]);
  const time = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const markets = Object.fromEntries(ctx.markets.map((m) => [m.slug, m.name]));
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <form role="search" className="flex gap-2">
        <label htmlFor="rq" className="sr-only">
          {t("search")}
        </label>
        <input
          id="rq"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("search")}
          className={inputClass}
        />
        <Button type="submit" variant="outline">
          {t("go")}
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title={t("none")} />
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label={t("title")}
          className="overflow-x-auto rounded-2xl border bg-card"
        >
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">{t("title")}</caption>
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("code")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("service")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("market")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("status")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("driver")}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {t("created")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(0, 200).map((r) => (
                <tr key={r.id} className="hover:bg-accent">
                  <th scope="row" className="px-4 py-2 text-left font-semibold">
                    <Link
                      href={`/requests/${encodeURIComponent(r.id)}`}
                      prefetch={false}
                      className="inline-flex min-h-12 items-center underline-offset-2 hover:underline"
                    >
                      {r.code}
                    </Link>{" "}
                    {r.demo ? <Badge tone="outline">{t("demo")}</Badge> : null}
                  </th>
                  <td className="px-4 py-2">
                    {ts.has(`${r.service}.name`) ? ts(`${r.service}.name`) : r.service}
                  </td>
                  <td className="px-4 py-2">{markets[r.market] ?? r.market}</td>
                  <td className="px-4 py-2">
                    {t.has(`statuses.${r.status}`) ? t(`statuses.${r.status}`) : r.status}
                  </td>
                  <td className="px-4 py-2">{r.driver}</td>
                  <td className="px-4 py-2 tabular-nums">{time.format(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
