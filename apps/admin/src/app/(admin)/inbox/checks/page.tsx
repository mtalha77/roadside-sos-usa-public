import { Alert } from "@rsos/ui/alert";
import { Badge } from "@rsos/ui/badge";
import { Button } from "@rsos/ui/button";
import { inputClass } from "@rsos/ui/input";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { clearFlagAction, spotCheckAction } from "@/lib/job-check-actions";
import { getJobChecks } from "@/lib/job-checks";

export const dynamic = "force-dynamic";
const card = "rounded-2xl border bg-card p-4 sm:p-5";

/**
 * Inbox > Job checks (RSOS-117): warning signs the system raised on jobs (done without arriving,
 * very short jobs, the same phone on both sides, many "customer not available", a locked code,
 * a customer saying it was not fixed, no-shows over the limit) and the weekly spot checks.
 */
export default async function JobChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const [ctx, t, locale, sp] = await Promise.all([
    getAdminContext(),
    getTranslations("admin.checks"),
    getLocale(),
    searchParams,
  ]);
  const ids = ctx.markets.filter((m) => ctx.selected.includes(m.slug)).map((m) => m.id);
  const data = await getJobChecks(ids);
  const when = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(iso),
        )
      : "—";
  const canAct = ["super_admin", "ops_manager", "dispatcher"].includes(ctx.role ?? "");
  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <Link href="/inbox" className="text-sm underline underline-offset-4">
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </header>
      {sp.done ? <Alert tone="success" title={t("done")} /> : null}
      {sp.error ? <Alert tone="critical" title={t("error")} /> : null}

      <section aria-labelledby="flags-h" className={card}>
        <h2 id="flags-h" className="mb-3 font-semibold">
          {t("flags.title", { count: data.flags.length })}
        </h2>
        {data.flags.length === 0 ? (
          <p className="text-sm">{t("flags.none")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.flags.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      f.kind === "code_locked" || f.kind === "customer_dispute"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {t(`kinds.${f.kind}`)}
                  </Badge>
                  <Link
                    href={`/providers/${f.providerId}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {f.provider}
                  </Link>
                  <span className="text-sm text-muted-foreground">{when(f.createdAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t(`help.${f.kind}`)}</p>
                {f.note ? <p className="text-sm">{f.note}</p> : null}
                {canAct ? (
                  <form action={clearFlagAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      {t("flags.note")}
                      <input name="note" maxLength={500} className={inputClass} />
                    </label>
                    {f.kind === "no_show_review" ? (
                      <>
                        <Button type="submit" name="decision" value="release" variant="outline">
                          {t("flags.release")}
                        </Button>
                        <Button type="submit" name="decision" value="charge" variant="outline">
                          {t("flags.charge")}
                        </Button>
                      </>
                    ) : (
                      <Button type="submit" name="decision" value="none" variant="outline">
                        {t("flags.clear")}
                      </Button>
                    )}
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="spot-h" className={card}>
        <h2 id="spot-h" className="mb-1 font-semibold">
          {t("spot.title", { count: data.spotChecks.length })}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("spot.lead")}</p>
        {data.spotChecks.length === 0 ? (
          <p className="text-sm">{t("spot.none")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {data.spotChecks.map((s) => (
              <li key={s.bookingId} className="flex flex-col gap-2 py-3">
                <p className="text-sm">
                  {t("spot.row", { code: s.code, provider: s.provider, when: when(s.doneAt) })}
                </p>
                {canAct ? (
                  <form action={spotCheckAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="booking" value={s.bookingId} />
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      {t("flags.note")}
                      <input name="note" maxLength={500} className={inputClass} />
                    </label>
                    <Button type="submit" name="ok" value="yes" variant="outline">
                      {t("spot.confirmed")}
                    </Button>
                    <Button type="submit" name="ok" value="no" variant="outline">
                      {t("spot.problem")}
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
