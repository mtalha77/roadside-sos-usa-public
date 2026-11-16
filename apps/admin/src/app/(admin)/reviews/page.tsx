import { demoMarkets } from "@rsos/config/demo-fixtures";
import { demoPortal } from "@rsos/core/demo";
import { Badge } from "@rsos/ui/badge";
import { EmptyState } from "@rsos/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import { ReviewQueue } from "@/components/reviews/review-queue";
import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";

export const dynamic = "force-dynamic";

/** Quality thresholds (RSOS-080): below these a provider is flagged for follow-up. */
const THRESHOLDS = { rating: 4.3, cancelRate: 0.08 };

async function load() {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  if (!ctx.demo) return { ctx, reviews: [], quality: [] };
  const portals = ctx.selected
    .filter((m) => demoMarkets[m])
    .flatMap((m) =>
      demoMarkets[m]!.providers.map((p) => ({
        m,
        p,
        portal: demoPortal(now, { marketSlug: m, providerSlug: p.slug }),
      })),
    );
  const reviews = portals
    .flatMap(({ p, portal }) =>
      portal.history
        .filter((j) => j.rating !== null)
        .slice(0, 4)
        .map((j) => ({
          id: `${p.slug}-${j.id}`,
          provider: p.name,
          code: j.code,
          rating: j.rating!,
          driver: j.driverName,
          at: j.at,
        })),
    )
    .sort((a, b) => a.rating - b.rating || b.at - a.at);
  const quality = portals.map(({ p, portal }) => {
    const done = portal.history.filter((j) => j.status === "won" || j.status === "cancelled");
    const cancelRate = done.length
      ? portal.history.filter((j) => j.status === "cancelled").length / done.length
      : 0;
    const rated = portal.history.filter((j) => j.rating !== null);
    const rating = rated.length ? rated.reduce((a, j) => a + j.rating!, 0) / rated.length : null;
    const score = Math.round(((rating ?? 4) / 5) * 70 + (1 - cancelRate) * 30);
    return { name: p.name, rating, cancelRate, score };
  });
  return { ctx, reviews, quality };
}

/**
 * Reviews and quality (RSOS-080): moderation queue (lowest ratings first), low-rating follow-ups
 * and provider quality scores with thresholds. Demo data (no reviews table yet).
 */
export default async function ReviewsPage() {
  const [t, locale, { ctx, reviews, quality }] = await Promise.all([
    getTranslations("admin.reviews"),
    getLocale(),
    load(),
  ]);
  const date = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    dateStyle: "medium",
  });
  return (
    <main id="main" className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {ctx.demo ? <p className="text-sm text-muted-foreground">{t("demo")}</p> : null}
      {reviews.length === 0 ? (
        <EmptyState title={t("none")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <ReviewQueue
            items={reviews.slice(0, 30).map((r) => ({ ...r, date: date.format(r.at) }))}
            labels={Object.fromEntries(
              [
                "queue",
                "approve",
                "hide",
                "followUp",
                "approved",
                "hidden",
                "followed",
                "stars",
                "low",
              ].map((k) => [k, String(t.raw(k))]),
            )}
          />
          <section aria-labelledby="q-h" className="rounded-2xl border bg-card p-4 sm:p-5">
            <h2 id="q-h" className="mb-1 font-semibold">
              {t("quality")}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("thresholds", {
                rating: THRESHOLDS.rating,
                cancel: Math.round(THRESHOLDS.cancelRate * 100),
              })}
            </p>
            <ul className="divide-y text-sm">
              {quality
                .sort((a, b) => a.score - b.score)
                .map((q) => {
                  const flagged =
                    (q.rating !== null && q.rating < THRESHOLDS.rating) ||
                    q.cancelRate > THRESHOLDS.cancelRate;
                  return (
                    <li
                      key={q.name}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="font-medium">{q.name}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {t("score", { score: q.score })}
                        {flagged ? <Badge tone="critical">{t("flag")}</Badge> : null}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
