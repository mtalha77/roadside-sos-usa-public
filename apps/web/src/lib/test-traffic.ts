import { createPublicSupabase } from "@rsos/db/public";
import { z } from "zod";

/**
 * Test traffic (owner decision 2, 2026-11-19). A visit is test traffic when:
 * - the session started with `?rsos_test=1` (a cookie for this browser session);
 * - it opened a test device link `?rsos_test=<token>` from Admin > Settings > Test traffic (a
 *   long-lived device cookie, checked against the list);
 * - its IP is on the admin-managed test list;
 * - staff are signed in to the admin in this browser (the admin sets `rsos_test=staff`).
 * The proxy marks such requests with `x-rsos-test: 1`; database calls then send the same header,
 * and the database tags the rows and keeps them out of analytics and ad conversions.
 */
export const TEST_COOKIE = "rsos_test";
export const TEST_DEVICE_COOKIE = "rsos_test_device";
export const TEST_HEADER = "x-rsos-test";

const Token = z.string().regex(/^[A-Za-z0-9_-]{24,64}$/);

// Answers are cached per server instance for 5 minutes (the list changes rarely).
const cache = new Map<string, { at: number; yes: boolean }>();
async function onList(ip: string | null, device: string | null): Promise<boolean> {
  const key = `${ip ?? ""}|${device ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 300_000) return hit.yes;
  const supabase = createPublicSupabase();
  if (!supabase) return false;
  const { data } = await (
    supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>
  )("is_test_traffic", { p_ip: ip ?? "", p_device: device ?? "" });
  const yes = data === true;
  if (cache.size > 5000) cache.clear();
  cache.set(key, { at: Date.now(), yes });
  return yes;
}

export type TestDecision = {
  test: boolean;
  /** Cookies to set on the response. */
  set: { name: string; value: string; session: boolean }[];
};

export async function testTraffic(req: {
  query: URLSearchParams;
  cookie: (name: string) => string | undefined;
  ip: string | null;
}): Promise<TestDecision> {
  const set: TestDecision["set"] = [];
  const param = req.query.get("rsos_test");
  if (param === "1") {
    set.push({ name: TEST_COOKIE, value: "1", session: true });
    return { test: true, set };
  }
  // A device link from the admin's test list: remember the device if the token is on the list.
  const token = Token.safeParse(param);
  if (token.success && (await onList(null, token.data))) {
    set.push({ name: TEST_DEVICE_COOKIE, value: token.data, session: false });
    return { test: true, set };
  }
  if (req.cookie(TEST_COOKIE)) return { test: true, set };
  const device = Token.safeParse(req.cookie(TEST_DEVICE_COOKIE));
  if (device.success && (await onList(null, device.data))) return { test: true, set };
  if (req.ip && /^[0-9a-fA-F:.]+$/.test(req.ip) && (await onList(req.ip, null)))
    return { test: true, set };
  return { test: false, set };
}

/** In server components and route handlers: is this request test traffic? */
export const isTestHeader = (h: Headers) => h.get(TEST_HEADER) === "1";
