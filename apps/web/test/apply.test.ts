import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async () => ({ data: "00000000-0000-4000-8000-000000000002", error: null }));
const emails: { to: string; tags?: Record<string, string> }[] = [];
const texts: { to: string; body: string }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@rsos/db/public", () => ({ createPublicSupabase: () => ({ rpc }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));
vi.mock("@/lib/forms", () => ({
  guardForm: async () => "ok",
  callerIp: async () => "203.0.113.9",
}));
vi.mock("@rsos/emails", async (orig) => ({
  ...(await orig<object>()),
  chooseEmailSender: () => ({
    mode: "mock",
    send: async (e: { to: string }) => (emails.push(e), { ok: true, id: "1", mode: "mock" }),
  }),
}));
vi.mock("@rsos/core", async (orig) => ({
  ...(await orig<object>()),
  chooseSmsSender: () => ({
    mode: "mock",
    send: async (to: string, body: string) => (
      texts.push({ to, body }),
      { ok: true, id: "1", mode: "mock" }
    ),
  }),
}));

const { submitApplicationAction } = await import("../src/lib/apply-action");
const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const valid = {
  company_name: "Dev Test Towing",
  contact_name: "Dev Tester",
  phone: "(713) 555-0177",
  email: "apply@example.test",
  markets: ["houston", "san-antonio"],
  services: ["tow", "flat-tire"],
  truck_count: "3",
  insurance_carrier: "Test Mutual",
  license_number: "00000000",
  referral_source: "Search",
  sms_consent: "on",
};

describe("provider application (RSOS-026)", () => {
  beforeEach(() => {
    rpc.mockClear();
    emails.length = 0;
    texts.length = 0;
  });

  it("AC1: stores every field with the markets and the SMS terms version", async () => {
    expect(await submitApplicationAction({}, form(valid))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_provider_application", {
      p: expect.objectContaining({
        company_name: "Dev Test Towing",
        contact_name: "Dev Tester",
        phone: "+17135550177",
        email: "apply@example.test",
        market_slugs: ["houston", "san-antonio"],
        service_slugs: ["tow", "flat-tire"],
        truck_count: "3",
        insurance_carrier: "Test Mutual",
        license_number: "00000000",
        referral_source: "Search",
        sms_consent: true,
        sms_policy_version: "2026-11-13-draft",
        ip: "203.0.113.9",
      }),
    });
  });

  it("AC2: confirms to the applicant by email and SMS (mock), and notifies the team", async () => {
    await submitApplicationAction({}, form(valid));
    expect(emails.map((e) => e.tags?.category)).toEqual([
      "provider-application",
      "provider-application-confirmation",
    ]);
    expect(texts).toEqual([
      { to: "+17135550177", body: expect.stringContaining("Dev Test Towing") },
    ]);
  });

  it("no text without opt-in; invalid input names the fields", async () => {
    await submitApplicationAction({}, form({ ...valid, sms_consent: [] }));
    expect(texts).toEqual([]);
    const bad = await submitApplicationAction({}, form({ ...valid, phone: "123", markets: [] }));
    expect(bad).toEqual({
      error: "required",
      fields: expect.arrayContaining(["phone", "market_slugs"]),
    });
  });
});
