import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { DispatchBoard } from "@/components/dispatch/dispatch-board";
import { getAdminContext } from "@/lib/admin";
import { getBoard } from "@/lib/board";
import { demoNow } from "@/lib/demo-clock";

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
  "demo",
  "real",
  "quotes",
  "waiting",
  "call",
  "push",
  "assign",
  "note",
  "cancel",
  "open",
  "empty",
  "count",
  "live",
  "paused",
  "pushed",
  "noted",
  "cancelled",
  "assigned",
  "softphone",
  "actions",
  "load",
  "loadOn",
  "error",
  "more",
] as const;

async function load() {
  const [ctx, now, jar] = await Promise.all([getAdminContext(), demoNow(), cookies()]);
  const loadTest = ctx.demo && jar.get("rsos_demo_load")?.value === "1";
  return {
    ctx,
    loadTest,
    board: await getBoard({ now, markets: ctx.selected, demo: ctx.demo, load: loadTest }),
  };
}

/**
 * Live dispatch board (RSOS-034 + 072): map and lanes (new, quoting, picked, en route, on site),
 * SLA timers (amber after 2 minutes without a quote, red after 3, with a sound), card actions and
 * the supply panel. Real requests appear within 2 seconds; demo ones are labelled.
 */
export default async function DispatchPage() {
  const [t, ts, { ctx, loadTest, board }] = await Promise.all([
    getTranslations("admin.dispatch"),
    getTranslations("site.services"),
    load(),
  ]);
  const services = Object.fromEntries(
    [...new Set(board.cards.map((c) => c.service))].map((s) => [
      s,
      ts.has(`${s}.name`) ? ts(`${s}.name`) : s,
    ]),
  );
  return (
    <DispatchBoard
      initial={board}
      demo={ctx.demo}
      loadTest={loadTest}
      services={services}
      markets={Object.fromEntries(ctx.markets.map((m) => [m.slug, m.name]))}
      labels={Object.fromEntries(KEYS.map((k) => [k, String(t.raw(k))]))}
    />
  );
}
