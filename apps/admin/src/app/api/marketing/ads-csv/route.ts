import type { NextRequest } from "next/server";
import { z } from "zod";
import { loadAdRows } from "@/components/marketing/ads-dashboard";
import { getAdminContext } from "@/lib/admin";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => {
  const s = String(v);
  // Neutralise spreadsheet formulas and quote anything with commas, quotes or line breaks.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The ads dashboard as CSV (RSOS-107): one row per day, market and channel. */
export async function GET(request: NextRequest) {
  const ctx = await getAdminContext();
  if (!["super_admin", "ops_manager", "marketing", "finance", "read_only"].includes(ctx.role))
    return new Response("Forbidden", { status: 403 });
  const q = z.object({ from: z.iso.date(), to: z.iso.date() }).safeParse({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  });
  if (!q.success) return new Response("Bad range", { status: 400 });
  const ids = ctx.markets.filter((m) => ctx.selected.includes(m.slug)).map((m) => m.id);
  const name = (id: string) => ctx.markets.find((m) => m.id === id)?.name ?? id;
  const rows = (await loadAdRows(q.data.from, q.data.to)).filter((r) => ids.includes(r.market_id));
  const head = [
    "day",
    "market",
    "channel",
    "spend_usd",
    "clicks",
    "calls",
    "qualified_calls",
    "requests",
    "assigned",
    "completed",
    "fees_usd",
  ];
  const lines = rows.map((r) =>
    [
      r.day,
      name(r.market_id),
      r.channel,
      (r.spend_cents / 100).toFixed(2),
      r.clicks,
      r.calls,
      r.qualified_calls,
      r.requests,
      r.assigned,
      r.completed,
      (r.fees_cents / 100).toFixed(2),
    ]
      .map(cell)
      .join(","),
  );
  return new Response([head.join(","), ...lines].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ads-${q.data.from}-to-${q.data.to}.csv"`,
    },
  });
}
