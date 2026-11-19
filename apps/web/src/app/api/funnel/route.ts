import { SOURCE_COOKIE } from "@rsos/core/adapters";
import { type NextRequest, NextResponse } from "next/server";
import { deviceOf, FLOW_COOKIE, FunnelEvent, readFlow, recordFunnel } from "@/lib/funnel";

/** The leave beacon from the Get Help screens (RSOS-111). Always answers 204. */
export async function POST(request: NextRequest) {
  const flow = readFlow(request.cookies.get(FLOW_COOKIE)?.value);
  const form = await request.formData().catch(() => null);
  const parsed = FunnelEvent.safeParse({
    event: form?.get("event"),
    step: form?.get("step"),
    field: form?.get("field") ?? null,
  });
  if (flow && parsed.success && parsed.data.event === "left")
    await recordFunnel({
      session: flow.session,
      event: "left",
      step: parsed.data.step,
      field: parsed.data.field ?? null,
      source: request.cookies.get(SOURCE_COOKIE)?.value ?? null,
      device: deviceOf(request.headers.get("user-agent")),
    });
  return new NextResponse(null, { status: 204 });
}
