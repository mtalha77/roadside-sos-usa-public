import { createPublicSupabase } from "@rsos/db/public";
import { z } from "zod";

/**
 * Booking funnel events (RSOS-111). A browser-session cookie holds when the visitor landed and a
 * random session id (no personal data). Events are recorded server-side and never slow a page:
 * failures are ignored.
 */
export const FLOW_COOKIE = "rsos_flow";

const Flow = z.string().regex(/^(\d{13})\.([A-Za-z0-9]{24,40})$/);

export function newFlowCookie(now = Date.now()): string {
  return `${now}.${crypto.randomUUID().replaceAll("-", "")}`;
}

/** The session id and landing time from the cookie, or null when missing or malformed. */
export function readFlow(raw: string | undefined): { session: string; landedAt: number } | null {
  const parsed = Flow.safeParse(raw);
  if (!parsed.success) return null;
  const [landed, session] = parsed.data.split(".") as [string, string];
  return { session, landedAt: Number(landed) };
}

export const deviceOf = (ua: string | null): "mobile" | "desktop" =>
  /Mobi|Android|iPhone/i.test(ua ?? "") ? "mobile" : "desktop";

export const FunnelEvent = z.object({
  event: z.enum(["step", "left", "submitted"]),
  step: z.enum(["problem", "location", "details"]),
  field: z
    .string()
    .regex(/^[A-Za-z]{1,40}$/)
    .nullish(),
});

export async function recordFunnel(e: {
  session: string;
  event: "step" | "left" | "submitted";
  step: "problem" | "location" | "details";
  field?: string | null;
  market?: string | null;
  source?: string | null;
  device?: "mobile" | "desktop" | null;
  landingSec?: number | null;
  requestToken?: string | null;
}): Promise<void> {
  const supabase = createPublicSupabase();
  if (!supabase) return;
  await (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<unknown>)(
    "record_funnel_event",
    {
      p_session: e.session,
      p_event: e.event,
      p_step: e.step,
      p_field: e.field ?? null,
      p_market_slug: e.market ?? null,
      p_source: e.source ?? null,
      p_device: e.device ?? null,
      p_landing_sec:
        e.landingSec === null || e.landingSec === undefined
          ? null
          : Math.min(86_400, Math.max(0, Math.round(e.landingSec))),
      p_request_token: e.requestToken ?? null,
    },
  ).then(
    () => undefined,
    () => undefined,
  );
}
