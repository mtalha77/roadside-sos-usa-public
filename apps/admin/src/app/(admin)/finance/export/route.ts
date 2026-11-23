import { getAdminContext } from "@/lib/admin";
import { demoNow } from "@/lib/demo-clock";
import { demoLedger } from "@/lib/finance";

export const dynamic = "force-dynamic";

/** Ledger export as CSV (RSOS-079). Finance and super admins only. */
export async function GET() {
  const [ctx, now] = await Promise.all([getAdminContext(), demoNow()]);
  if (!["super_admin", "finance"].includes(ctx.role))
    return new Response("Forbidden", { status: 403 });
  const rows = ctx.demo ? demoLedger(now, ctx.selected) : [];
  const csv = [
    "date,market,provider,type,job,amount_usd",
    ...rows.map((x) =>
      [
        new Date(x.at).toISOString(),
        x.market,
        `"${x.provider.replaceAll('"', '""')}"`,
        x.kind,
        x.job ?? "",
        (x.amountCents / 100).toFixed(2),
      ].join(","),
    ),
  ].join("\n");
  return new Response(`${csv}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="ledger.csv"',
    },
  });
}
