import { brand } from "@rsos/config/brand";
import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancelRealRequest, getRealRequest } from "@/lib/request-status";

type Params = { params: Promise<{ token: string }> };

/** Live status of a real request (the status page polls this every few seconds). */
export async function GET(_: NextRequest, { params }: Params) {
  const req = await getRealRequest((await params).token);
  return req
    ? NextResponse.json(req, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: "not found" }, { status: 404 });
}

const Action = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel"),
    reason: z.enum(["found_help", "too_slow", "too_expensive", "fixed", "other"]),
  }),
  z.object({
    action: z.literal("report"),
    kind: z.enum(["no_show", "overcharge", "damage", "safety"]),
    details: z.string().max(2000),
  }),
]);

/** Driver actions on a real request: cancel with a reason, or report a problem to the team. */
export async function POST(request: NextRequest, { params }: Params) {
  const token = (await params).token;
  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const req = await getRealRequest(token);
  if (!req) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (parsed.data.action === "cancel")
    return NextResponse.json({ ok: await cancelRealRequest(token, parsed.data.reason) });
  const supabase = createPublicSupabase();
  const { error } = await (
    supabase!.rpc as unknown as (f: string, a: object) => PromiseLike<{ error: unknown }>
  )("submit_contact_message", {
    p: {
      name: `Driver on ${req.short_code}`,
      email: brand.emails.support,
      topic: "job",
      market_slug: req.market_slug,
      message:
        `Problem report on request ${req.short_code}: ${parsed.data.kind}. ${parsed.data.details}`.slice(
          0,
          5000,
        ),
    },
  });
  return NextResponse.json({ ok: !error });
}
