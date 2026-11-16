import { cookies } from "next/headers";
import { getAdminContext } from "@/lib/admin";
import { getBoard } from "@/lib/board";
import { demoNow } from "@/lib/demo-clock";

export const dynamic = "force-dynamic";

/** Dispatch board data, polled every 2 seconds by the board (staff only, enforced by the proxy). */
export async function GET() {
  const [ctx, now, jar] = await Promise.all([getAdminContext(), demoNow(), cookies()]);
  const board = await getBoard({
    now,
    markets: ctx.selected,
    demo: ctx.demo,
    load: ctx.demo && jar.get("rsos_demo_load")?.value === "1",
  });
  return Response.json(board, { headers: { "cache-control": "no-store" } });
}
