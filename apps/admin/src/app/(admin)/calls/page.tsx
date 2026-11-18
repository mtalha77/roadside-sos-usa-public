import { formatDateTime, type Locale } from "@rsos/i18n";
import { EmptyState } from "@rsos/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { CallsTable } from "@/components/calls/calls-table";
import { AutoRefresh } from "@/components/today/auto-refresh";
import { getAdminContext } from "@/lib/admin";
import { CALL_OUTCOMES, listCalls, OutcomeFilter } from "@/lib/calls";

export const dynamic = "force-dynamic";

const TABLE_KEYS = [
  "caption",
  "time",
  "direction",
  "outcome",
  "from",
  "to",
  "duration",
  "market",
  "request",
  "search",
  "columns",
  "empty",
  "previous",
  "next",
  "page",
  "sortBy",
] as const;

/**
 * Calls (RSOS-103): the call log for the markets in view over the last 7 days. "Log a call" opens
 * phone intake (merged here and into the Inbox); filters by outcome (missed, voicemail...).
 */
export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string }>;
}) {
  const [t, locale, ctx, sp] = await Promise.all([
    getTranslations("admin.calls"),
    getLocale(),
    getAdminContext(),
    searchParams,
  ]);
  const outcome = OutcomeFilter.parse(sp.outcome);
  const markets = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const calls = await listCalls(markets, outcome);
  const tz = new Map(markets.map((m) => [m.name, m.timeZone]));
  const rows = calls.map((c) => ({
    id: c.id,
    at: c.at,
    time: formatDateTime(c.at, locale as Locale, tz.get(c.market) ?? "UTC", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    market: c.market,
    direction: t(`directions.${c.direction}`),
    outcome: c.outcome,
    outcomeLabel: t(`outcomes.${c.outcome}`),
    from: c.from,
    to: c.to,
    duration:
      c.durationSec === null
        ? "–"
        : `${Math.floor(c.durationSec / 60)}:${String(c.durationSec % 60).padStart(2, "0")}`,
    requestId: c.requestId,
    requestCode: c.requestCode,
  }));
  const chip =
    "inline-flex min-h-10 items-center rounded-full border px-3 text-sm hover:bg-accent aria-[current=true]:border-primary aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground";
  return (
    <main id="main" className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
      <AutoRefresh />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <Link
          href="/intake"
          className="inline-flex min-h-12 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {t("log")}
        </Link>
      </header>
      <nav aria-label={t("filter")} className="flex flex-wrap gap-2">
        <Link href="/calls" className={chip} aria-current={!outcome}>
          {t("all")}
        </Link>
        {CALL_OUTCOMES.filter((o) => o !== "ringing").map((o) => (
          <Link key={o} href={`/calls?outcome=${o}`} className={chip} aria-current={outcome === o}>
            {t(`outcomes.${o}`)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <CallsTable
          rows={rows}
          labels={Object.fromEntries(TABLE_KEYS.map((k) => [k, String(t.raw(`table.${k}`))]))}
        />
      )}
    </main>
  );
}
