import { getPortalContext, getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

/** Wallet statement as CSV (RSOS-057). Owners and managers only. */
export async function GET() {
  const ctx = await getPortalContext();
  if (!ctx.canSeeMoney) return new Response("Forbidden", { status: 403 });
  const { data } = await getPortalData(ctx, Date.now());
  const rows = [
    "date,type,amount_usd,job",
    ...data.txns.map((x) =>
      [
        new Date(x.at).toISOString(),
        x.kind,
        (x.amountCents / 100).toFixed(2),
        x.jobCode ?? "",
      ].join(","),
    ),
  ];
  return new Response(`${rows.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="wallet-statement.csv"',
    },
  });
}
