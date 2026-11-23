import { chooseMetaConversions } from "@rsos/core/adapters";
import { createAdminSupabase } from "@rsos/db/admin";
import type { NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

/**
 * Sends conversion events not yet delivered to Meta's Conversions API (RSOS-031). Runs on Vercel
 * Cron with CRON_SECRET. Off (fake, nothing marked) unless META_CAPI_ENABLED is "true" with a pixel
 * and token. Event ids deduplicate with the browser pixel.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const meta = chooseMetaConversions();
  if (meta.mode === "fake") return Response.json({ ok: true, meta: "off" });
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("conversion_events")
    .select("event_id, name, occurred_at, service_slug, source, value_cents, fbclid, markets(slug)")
    .is("meta_sent_at", null)
    .gte("occurred_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("occurred_at")
    .limit(500);
  const events = (data ?? []).map((e) => ({
    eventId: e.event_id,
    name: e.name,
    occurredAt: e.occurred_at,
    marketSlug: (e.markets as { slug?: string } | null)?.slug ?? "",
    service: e.service_slug,
    source: e.source,
    valueCents: e.value_cents,
    fbclid: e.fbclid,
  }));
  const result = await meta.send(events);
  if (result.ok && events.length)
    await admin
      .from("conversion_events")
      .update({ meta_sent_at: new Date().toISOString() })
      .in(
        "event_id",
        events.map((e) => e.eventId),
      );
  return Response.json({ ok: result.ok, sent: result.sent });
}
