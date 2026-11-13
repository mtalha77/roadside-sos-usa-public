import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async () => ({ data: "00000000-0000-4000-8000-000000000001", error: null }));
const sent: { to: string; tags?: Record<string, string> }[] = [];
let guard: "ok" | "limit" | "turnstile" = "ok";

vi.mock("server-only", () => ({}));
vi.mock("@rsos/db/public", () => ({ createPublicSupabase: () => ({ rpc }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/forms", () => ({ guardForm: async () => guard }));
vi.mock("@rsos/emails", async (orig) => ({
  ...(await orig<object>()),
  chooseEmailSender: () => ({
    mode: "mock",
    send: async (e: { to: string; tags?: Record<string, string> }) => {
      sent.push(e);
      return { ok: true, id: "1", mode: "mock" };
    },
  }),
}));

const { submitContactAction } = await import("../src/lib/contact-action");
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const valid = {
  name: "Dev Test",
  email: "dev@example.test",
  phone: "(713) 555-0123",
  topic: "job",
  message: "Hello",
  market: "houston",
};

describe("contact form (RSOS-027 AC2)", () => {
  beforeEach(() => {
    rpc.mockClear();
    sent.length = 0;
    guard = "ok";
  });

  it("stores the message and triggers the email interface (team notice + confirmation)", async () => {
    expect(await submitContactAction({}, form(valid))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_contact_message", {
      p: {
        name: "Dev Test",
        email: "dev@example.test",
        phone: "+17135550123",
        topic: "job",
        message: "Hello",
        market_slug: "houston",
      },
    });
    expect(sent.map((s) => s.tags?.category)).toEqual(["contact", "contact-confirmation"]);
    expect(sent[1]?.to).toBe("dev@example.test");
  });

  it("validates first, then rate limits and checks Turnstile before storing anything", async () => {
    expect(await submitContactAction({}, form({ ...valid, email: "nope" }))).toEqual({
      error: "required",
    });
    guard = "turnstile";
    expect(await submitContactAction({}, form(valid))).toEqual({ error: "turnstile" });
    guard = "limit";
    expect(await submitContactAction({}, form(valid))).toEqual({ error: "limit" });
    expect(rpc).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });
});
