import { createPublicSupabase } from "@rsos/db/public";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancelRealRequest, getRealRequest, setBookingMode } from "@/lib/request-status";
import { isTestHeader } from "@/lib/test-traffic";

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
    action: z.literal("booking_mode"),
    mode: z.enum(["compare", "instant"]),
    maxCents: z.number().int().min(500).max(1_000_000),
  }),
  z.object({
    action: z.literal("report"),
    // Owner decision 3: one tap plus a reason, an optional note.
    reason: z.enum(["no_show", "price_changed", "poor_service", "safety", "other"]),
    note: z.string().trim().max(500).optional(),
  }),
]);

/** Customer actions on a real request: cancel with a reason, or report a problem (a flag). */
export async function POST(request: NextRequest, { params }: Params) {
  const token = (await params).token;
  const parsed = Action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const req = await getRealRequest(token);
  if (!req) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (parsed.data.action === "cancel")
    return NextResponse.json({ ok: await cancelRealRequest(token, parsed.data.reason) });
  if (parsed.data.action === "booking_mode")
    return NextResponse.json({
      ok: await setBookingMode(token, parsed.data.mode, parsed.data.maxCents),
    });
  // The flag goes to the admin Inbox (safety is urgent) and onto the request and both profiles.
  const supabase = createPublicSupabase({ test: isTestHeader(request.headers) });
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { error } = await (
    supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ error: unknown }>
  )("flag_request_as_customer", {
    p_token: token,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note ?? null,
  });
  return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
}
