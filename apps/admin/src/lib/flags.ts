import "server-only";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

/** Flags on requests (owner decision 3): customers report problems, providers flag requests. */
export type RequestFlag = {
  id: string;
  requestId: string;
  side: "customer" | "provider";
  reason: string;
  note: string | null;
  priority: "urgent" | "normal";
  status: "open" | "resolved";
  resolution: string | null;
  providerName: string | null;
  code: string | null;
  createdAt: string;
};

const Row = z.object({
  id: z.string(),
  request_id: z.string(),
  side: z.enum(["customer", "provider"]),
  reason: z.string(),
  note: z.string().nullable(),
  priority: z.enum(["urgent", "normal"]),
  status: z.enum(["open", "resolved"]),
  resolution: z.string().nullable(),
  created_at: z.string(),
  providers: z.object({ name: z.string() }).nullable(),
  requests: z.object({ short_code: z.string() }).nullable(),
});
const SELECT =
  "id, request_id, side, reason, note, priority, status, resolution, created_at, providers(name), requests(short_code)";

const toFlag = (r: z.infer<typeof Row>): RequestFlag => ({
  id: r.id,
  requestId: r.request_id,
  side: r.side,
  reason: r.reason,
  note: r.note,
  priority: r.priority,
  status: r.status,
  resolution: r.resolution,
  providerName: r.providers?.name ?? null,
  code: r.requests?.short_code ?? null,
  createdAt: r.created_at,
});
const parse = (rows: unknown) =>
  (Array.isArray(rows) ? rows : []).flatMap((r) => {
    const p = Row.safeParse(r);
    return p.success ? [toFlag(p.data)] : [];
  });

/** Every flag on one request, newest first (RLS: staff in the request's market). */
export async function getRequestFlags(requestId: string): Promise<RequestFlag[]> {
  const { data } = await (
    await getServerSupabase()
  )
    .from("request_flags")
    .select(SELECT)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });
  return parse(data);
}

/** Flags about a provider (raised by customers) or about a customer (raised by providers). */
export async function getProfileFlags(
  by: { providerId: string } | { phone: string },
): Promise<RequestFlag[]> {
  const s = await getServerSupabase();
  const q = s.from("request_flags").select(SELECT).eq("is_test", false);
  if ("providerId" in by) {
    const { data } = await q
      .eq("side", "customer")
      .eq("provider_id", by.providerId)
      .order("created_at", { ascending: false })
      .limit(50);
    return parse(data);
  }
  const { data: reqs } = await s
    .from("requests")
    .select("id")
    .eq("driver_phone", by.phone)
    .limit(200);
  const ids = (reqs ?? []).map((r) => r.id);
  if (ids.length === 0) return [];
  const { data } = await q
    .eq("side", "provider")
    .in("request_id", ids)
    .order("created_at", { ascending: false })
    .limit(50);
  return parse(data);
}

/** Open flags in these markets, for the Inbox. */
export async function getOpenFlags(marketIds: string[]) {
  if (marketIds.length === 0) return [];
  const { data } = await (
    await getServerSupabase()
  )
    .from("request_flags")
    .select("request_id, priority")
    .in("market_id", marketIds)
    .eq("status", "open")
    .limit(500);
  return data ?? [];
}
