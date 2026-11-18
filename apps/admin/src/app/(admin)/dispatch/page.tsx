import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { DispatchBoard } from "@/components/dispatch/dispatch-board";
import { getAdminContext } from "@/lib/admin";
import { getBoard } from "@/lib/board";
import { demoNow } from "@/lib/demo-clock";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const KEYS = [
  "title",
  "map",
  "supply",
  "gap",
  "online",
  "lanes.new",
  "lanes.quoting",
  "lanes.picked",
  "lanes.en_route",
  "lanes.on_site",
  "lanes.closing",
  "laneEmpty",
  "demo",
  "real",
  "quotes",
  "quotesLabel",
  "waiting",
  "stale",
  "call",
  "push",
  "assign",
  "note",
  "cancel",
  "open",
  "empty",
  "count",
  "live",
  "pushed",
  "noted",
  "assigned",
  "softphone",
  "error",
  "more",
  "market",
  "source",
  "sources.real",
  "sources.demo",
  "sources.both",
  "keys",
  "close",
  "customer",
  "phone",
  "where",
  "provider",
  "kind",
  "pageTour",
] as const;

const Source = z.enum(["real", "demo", "both"]).catch("real");

/**
 * Live dispatch board (RSOS-034 + 072, rebuilt in RSOS-103): one market at a time, lanes plus
 * "Needs closing", Real / Demo / Both (Real by default everywhere), a side panel per request and
 * keyboard control. Real requests appear within 2 seconds; demo ones carry a Demo tag.
 */
export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; source?: string }>;
}) {
  const [t, ts, ctx, now, jar, sp] = await Promise.all([
    getTranslations("admin.dispatch"),
    getTranslations("site.services"),
    getAdminContext(),
    demoNow(),
    cookies(),
    searchParams,
  ]);
  const board = await getBoard({
    now,
    markets: ctx.selected,
    demo: ctx.demo,
    load: ctx.demo && jar.get("rsos_demo_load")?.value === "1",
  });
  const inView = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const market = inView.some((m) => m.slug === sp.market) ? sp.market! : (inView[0]?.slug ?? "");
  const services = Object.fromEntries(
    [...new Set(board.cards.map((c) => c.service))].map((s) => [
      s,
      ts.has(`${s}.name`) ? ts(`${s}.name`) : s,
    ]),
  );
  return (
    <DispatchBoard
      initial={board}
      market={market}
      source={Source.parse(sp.source)}
      services={services}
      markets={Object.fromEntries(inView.map((m) => [m.slug, m.name]))}
      labels={Object.fromEntries(KEYS.map((k) => [k, String(t.raw(k))]))}
    />
  );
}
