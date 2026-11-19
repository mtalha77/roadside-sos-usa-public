import "server-only";
import type { AdminContext } from "@/lib/admin";
import { getBoard, type BoardCard } from "@/lib/board";
import { ageTone } from "@/lib/board-time";
import { getInbox, type InboxItem } from "@/lib/inbox";
import { getServerSupabase } from "@/lib/supabase/server";

export type UrgentItem = {
  id: string;
  code: string;
  market: string;
  /** What happened, as a message key under admin.today.reasons. */
  reason: "noQuote" | "unclaimed" | "missedCall" | "closing";
  /** The one primary action, as a message key under admin.today.do. */
  action: "claim" | "callBack" | "assign" | "close";
  href: string;
  since: number;
  demo: boolean;
  /** RSOS-110: where it came from (website or a call). */
  channel: "website" | "phone";
  /** Sort weight: higher is more urgent. */
  weight: number;
};
export type MarketDay = {
  slug: string;
  name: string;
  requests: number;
  filled: number;
  completed: number;
  medianAssignMs: number | null;
  feesCents: number;
  /** Providers online now (demo supply), or null when there is no presence data. */
  online: number | null;
  verified: number;
};

/** The start of "today" in a market's own time zone, as a timestamp. */
export function startOfDay(now: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(now);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return now - ((n("hour") * 60 + n("minute")) * 60 + n("second")) * 1000 - (now % 1000);
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * Everything the Today page shows (RSOS-103), for the markets in view: what needs a human now, the
 * ten most urgent items with one action each, today's numbers per market and alerts. Real data
 * (RLS decides what each person sees); demo requests join in demo mode, labelled.
 */
export async function getToday(ctx: AdminContext, now: number) {
  const supabase = await getServerSupabase();
  const markets = ctx.markets.filter((m) => ctx.selected.includes(m.slug));
  const ids = markets.map((m) => m.id);
  const since = Math.min(now - 24 * 3_600_000, ...markets.map((m) => startOfDay(now, m.timeZone)));
  const [inbox, board, calls, requests, providers] = await Promise.all([
    getInbox(ids),
    getBoard({ now, markets: ctx.selected, demo: ctx.demo, load: false }),
    ids.length
      ? supabase
          .from("calls")
          .select("id, market_id, direction, outcome, from_phone, to_phone, request_id, created_at")
          .in("market_id", ids)
          .gte("created_at", new Date(now - 24 * 3_600_000).toISOString())
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("requests")
          .select(
            "id, market_id, status, created_at, submitted_at, accepted_at, completed_at, platform_fee_cents",
          )
          .in("market_id", ids)
          .gte("created_at", new Date(since).toISOString())
          .limit(2000)
      : Promise.resolve({ data: [] }),
    supabase.from("providers").select("id, status, market_ids, is_demo").eq("status", "active"),
  ]);
  const slugOf = new Map(markets.map((m) => [m.id, m.slug]));

  // Calls nobody answered and nobody returned yet (an outbound call to that number afterwards).
  const callRows = calls.data ?? [];
  const missed = callRows.filter(
    (c) =>
      c.direction === "inbound" &&
      (c.outcome === "missed" || c.outcome === "voicemail") &&
      !callRows.some(
        (o) =>
          o.direction === "outbound" && o.to_phone === c.from_phone && o.created_at > c.created_at,
      ),
  );

  const waiting = (c: BoardCard) => c.lane === "new";
  const noQuote = board.cards.filter(
    (c) => waiting(c) && ageTone(true, now - c.createdAt) !== null,
  );
  const closing = board.cards.filter((c) => c.lane === "closing");
  const unclaimed = inbox.items.filter((i: InboxItem) => !i.owner);

  const items: UrgentItem[] = [
    ...noQuote.map((c) => ({
      id: c.id,
      code: c.code,
      market: c.market,
      reason: "noQuote" as const,
      action: "assign" as const,
      href: c.demo ? `/dispatch?market=${c.market}&source=demo` : `/inbox?id=${c.id}`,
      since: c.createdAt,
      demo: c.demo,
      channel: c.channel,
      weight: 3,
    })),
    ...missed.map((c) => ({
      id: c.id,
      code: c.from_phone,
      market: slugOf.get(c.market_id) ?? "",
      reason: "missedCall" as const,
      action: "callBack" as const,
      href: c.request_id ? `/inbox?id=${c.request_id}` : "/calls?outcome=missed",
      since: Date.parse(c.created_at),
      demo: false,
      channel: "phone" as const,
      weight: 2,
    })),
    ...unclaimed
      .filter((i) => !noQuote.some((c) => c.id === i.id))
      .map((i) => ({
        id: i.id,
        code: i.code,
        market: slugOf.get(i.marketId) ?? "",
        reason: "unclaimed" as const,
        action: "claim" as const,
        href: `/inbox?id=${i.id}`,
        since: i.createdAt,
        demo: false,
        channel: i.channel === "phone" ? ("phone" as const) : ("website" as const),
        weight: i.urgent ? 2.5 : 1.5,
      })),
    ...closing.map((c) => ({
      id: c.id,
      code: c.code,
      market: c.market,
      reason: "closing" as const,
      action: "close" as const,
      href: c.demo ? `/dispatch?market=${c.market}&source=demo` : `/inbox?id=${c.id}`,
      since: c.progressAt,
      demo: c.demo,
      channel: c.channel,
      weight: 1,
    })),
  ];
  // Real before demo, then the most urgent kind, then the longest wait.
  items.sort((a, b) => Number(a.demo) - Number(b.demo) || b.weight - a.weight || a.since - b.since);
  const needAction = [...unclaimed.map((i) => i.createdAt), ...noQuote.map((c) => c.createdAt)];

  const reqRows = requests.data ?? [];
  const verified = providers.data ?? [];
  const days: MarketDay[] = markets.map((m) => {
    const start = startOfDay(now, m.timeZone);
    const today = reqRows.filter((r) => r.market_id === m.id && Date.parse(r.created_at) >= start);
    const filled = today.filter((r) => r.accepted_at);
    const supply = board.supply.filter((s) => s.market === m.slug);
    return {
      slug: m.slug,
      name: m.name,
      requests: today.length,
      filled: filled.length,
      completed: today.filter((r) => r.status === "completed").length,
      medianAssignMs: median(
        filled.map((r) => Date.parse(r.accepted_at!) - Date.parse(r.submitted_at ?? r.created_at)),
      ),
      feesCents: filled.reduce((n, r) => n + r.platform_fee_cents, 0),
      online: supply.length ? supply.reduce((n, s) => n + s.online, 0) : null,
      verified: verified.filter((p) => p.market_ids.includes(m.id) && !p.is_demo).length,
    };
  });

  return {
    now,
    needAction: needAction.length,
    oldestWaiting: needAction.length ? Math.min(...needAction) : null,
    missedCalls: missed.length,
    noQuote: noQuote.length,
    urgent: items.slice(0, 10),
    days,
    alerts: {
      stale: closing.filter((c) => !c.demo || ctx.demo).length,
      emptyMarkets: days.filter((d) => (d.online ?? d.verified) === 0).map((d) => d.name),
    },
  };
}
export type Today = Awaited<ReturnType<typeof getToday>>;
