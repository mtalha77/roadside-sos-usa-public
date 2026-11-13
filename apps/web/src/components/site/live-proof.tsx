import { getTranslations } from "next-intl/server";
import type { MarketStats } from "@/lib/site-data";

/** Live numbers for a market, shown only when real data exists (never placeholders). */
export async function LiveProof({ stats, city }: { stats: MarketStats | null; city: string }) {
  if (!stats || (stats.provider_count === 0 && stats.avg_eta_minutes === null)) return null;
  const t = await getTranslations("home.proof");
  return (
    <section aria-labelledby="proof-title" className="rounded-2xl border bg-card p-5">
      <h2 id="proof-title" className="text-lg font-semibold">
        {t("title", { city })}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
        {stats.provider_count > 0 ? (
          <li>{t("providers", { count: stats.provider_count })}</li>
        ) : null}
        {stats.avg_eta_minutes !== null ? (
          <li>{t("eta", { minutes: stats.avg_eta_minutes })}</li>
        ) : null}
      </ul>
      {stats.avg_eta_minutes !== null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("basis", { count: stats.completed_jobs })}
        </p>
      ) : null}
    </section>
  );
}
