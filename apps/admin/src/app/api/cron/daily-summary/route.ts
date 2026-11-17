import { timingSafeEqual } from "node:crypto";
import { brand } from "@rsos/config/brand";
import { createAdminSupabase } from "@rsos/db/admin";
import {
  type DailySummaryRow,
  DailySummaryEmail,
  chooseEmailSender,
  dailySummarySubject,
} from "@rsos/emails";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const authorized = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(`Bearer ${secret}`);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Daily dispatch summary for the owner (RSOS-035), run by Vercel Cron each morning with
 * CRON_SECRET. Yesterday (UTC) per market: requests, calls, missed, assigned, completed, no
 * provider, and the manual_test fees that would have been earned.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminSupabase();
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 86_400_000);
  const range = { from: start.toISOString(), to: end.toISOString() };
  const [{ data: markets }, { data: requests }, { data: calls }, { data: fees }] =
    await Promise.all([
      admin.from("markets").select("id, name").in("status", ["test", "active"]),
      admin
        .from("requests")
        .select("market_id, status, assigned_at")
        .gte("created_at", range.from)
        .lt("created_at", range.to),
      admin
        .from("calls")
        .select("market_id, outcome, direction")
        .gte("created_at", range.from)
        .lt("created_at", range.to),
      admin
        .from("provider_billing_events")
        .select("amount_cents, requests(market_id)")
        .eq("kind", "manual_test")
        .gte("created_at", range.from)
        .lt("created_at", range.to),
    ]);
  const rows: DailySummaryRow[] = (markets ?? [])
    .map((m) => {
      const req = (requests ?? []).filter((r) => r.market_id === m.id);
      const cl = (calls ?? []).filter((c) => c.market_id === m.id && c.direction === "inbound");
      return {
        market: m.name,
        requests: req.length,
        calls: cl.length,
        missed: cl.filter((c) => c.outcome === "missed" || c.outcome === "voicemail").length,
        assigned: req.filter((r) => r.assigned_at).length,
        completed: req.filter((r) => r.status === "completed").length,
        noProvider: req.filter((r) => r.status === "no_provider").length,
        feesCents: (fees ?? [])
          .filter((f) => (f.requests as { market_id?: string } | null)?.market_id === m.id)
          .reduce((n, f) => n + f.amount_cents, 0),
      };
    })
    .filter((r) => r.requests + r.calls > 0);
  const day = start.toISOString().slice(0, 10);
  const sent = await chooseEmailSender().send({
    to: brand.emails.support,
    subject: dailySummarySubject(day),
    react: DailySummaryEmail({ day, rows }),
    tags: { category: "daily_summary" },
  });
  return Response.json({ ok: sent.ok, day, markets: rows.length });
}
