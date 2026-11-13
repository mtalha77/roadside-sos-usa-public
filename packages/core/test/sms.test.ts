import { describe, expect, it, vi } from "vitest";
import { chooseSmsSender, createMockSmsSender, createTwilioSmsSender } from "../src/sms";

describe("SMS interface", () => {
  it("posts to Twilio with basic auth and returns the message SID", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ sid: "SM123" }), { status: 201 }),
    );
    const sms = createTwilioSmsSender(
      "AC1",
      "token",
      "+12105550100",
      fetchImpl as unknown as typeof fetch,
    );
    expect(await sms.send("+17135550123", "Hello")).toEqual({
      ok: true,
      id: "SM123",
      mode: "twilio",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${btoa("AC1:token")}`,
    );
    expect(String(init.body)).toContain("From=%2B12105550100");
  });

  it("uses a messaging service when configured, and fails safely", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 500 }));
    const sms = createTwilioSmsSender("AC1", "t", "MG42", fetchImpl as unknown as typeof fetch);
    expect(await sms.send("+17135550123", "x")).toEqual({ ok: false, reason: "error" });
    expect(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body)).toContain(
      "MessagingServiceSid=MG42",
    );
    expect(await sms.send("not a phone", "x")).toEqual({ ok: false, reason: "error" });
  });

  it("chooses Twilio, the mock or unavailable by environment", async () => {
    expect(
      chooseSmsSender({
        TWILIO_ACCOUNT_SID: "a",
        TWILIO_AUTH_TOKEN: "b",
        TWILIO_FROM_NUMBER: "+12105550100",
      }).mode,
    ).toBe("twilio");
    expect(chooseSmsSender({ NEXT_PUBLIC_SITE_ENV: "preview" }).mode).toBe("mock");
    const off = chooseSmsSender({ NEXT_PUBLIC_SITE_ENV: "production" });
    expect(off.mode).toBe("unavailable");
    expect(await off.send("+17135550123", "x")).toEqual({ ok: false, reason: "not-configured" });
    const mock = createMockSmsSender();
    await mock.send("+17135550123", "hi");
    expect(mock.outbox).toEqual([{ to: "+17135550123", body: "hi" }]);
  });
});
