import { SOURCE_COOKIE } from "@rsos/core/adapters";
import { callerIpFrom, enforceRateLimit } from "@rsos/db/rate-limit";
import { type NextRequest, NextResponse } from "next/server";
import { deviceOf, FLOW_COOKIE, FunnelEvent, readFlow, recordFunnel } from "@/lib/funnel";
import { isTestHeader } from "@/lib/test-traffic";

/** The leave beacon from the Get Help screens (RSOS-111). Always answers 204 (rows over the per-IP limit are dropped). */
export async function POST(request: NextRequest) {
  const flow = readFlow(request.cookies.get(FLOW_COOKIE)?.value);
  const form = await request.formData().catch(() => null);
  const parsed = FunnelEvent.safeParse({
    event: form?.get("event"),
    step: form?.get("step"),
    field: form?.get("field") ?? null,
  });
  if (
    flow &&
    parsed.success &&
    parsed.data.event === "left" &&
    (await enforceRateLimit("funnel", { ip: callerIpFrom(request.headers) })).allowed
  )
    await recordFunnel({
      session: flow.session,
      event: "left",
      step: parsed.data.step,
      field: parsed.data.field ?? null,
      source: request.cookies.get(SOURCE_COOKIE)?.value ?? null,
      device: deviceOf(request.headers.get("user-agent")),
      test: isTestHeader(request.headers),
    });
  return new NextResponse(null, { status: 204 });
}
