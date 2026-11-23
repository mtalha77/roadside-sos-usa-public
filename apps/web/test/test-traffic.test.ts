import { describe, expect, it } from "vitest";
import { testTraffic } from "../src/lib/test-traffic";

// Owner decision 2: which visits are test traffic (the list lookups need Supabase and are covered
// by supabase/tests/037_test_traffic.test.sql).
const req = (query: string, cookies: Record<string, string> = {}) => ({
  query: new URLSearchParams(query),
  cookie: (n: string) => cookies[n],
  ip: null,
});

describe("test traffic", () => {
  it("?rsos_test=1 starts a test session (a cookie for this browser session)", async () => {
    expect(await testTraffic(req("rsos_test=1"))).toEqual({
      test: true,
      set: [{ name: "rsos_test", value: "1", session: true }],
    });
  });
  it("the session cookie, or the staff marker from the admin, keeps it test traffic", async () => {
    expect((await testTraffic(req("", { rsos_test: "1" }))).test).toBe(true);
    expect((await testTraffic(req("", { rsos_test: "staff" }))).test).toBe(true);
  });
  it("everyone else is real traffic", async () => {
    expect(await testTraffic(req("utm_source=google"))).toEqual({ test: false, set: [] });
    expect((await testTraffic(req("rsos_test=0"))).test).toBe(false);
  });
});
