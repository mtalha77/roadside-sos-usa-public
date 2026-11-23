import { describe, expect, it } from "vitest";
import {
  choosePhoneVerifier,
  createMockPhoneVerifier,
  MOCK_CODE,
  type PhoneVerifier,
} from "../src/phone-verification";

describe("phone verification", () => {
  it("mock accepts only the documented code after start", async () => {
    const v = createMockPhoneVerifier();
    expect(await v.check("+15125550101", MOCK_CODE)).toEqual({ ok: false, reason: "expired" });
    await v.start("+15125550101");
    expect(await v.check("+15125550101", "123456")).toEqual({ ok: false, reason: "invalid-code" });
    expect(await v.check("+15125550101", MOCK_CODE)).toEqual({ ok: true });
  });

  it("uses the mock only in development and preview; never in staging or production", async () => {
    expect(choosePhoneVerifier({ siteEnv: "preview", smsEnabled: false }).kind).toBe("mock");
    expect(choosePhoneVerifier({ siteEnv: "development", smsEnabled: false }).kind).toBe("mock");
    const prod = choosePhoneVerifier({ siteEnv: "production", smsEnabled: false });
    expect(prod.kind).toBe("unavailable");
    expect(await prod.start("+15125550101")).toEqual({ ok: false, reason: "unavailable" });
    expect(choosePhoneVerifier({ siteEnv: "staging", smsEnabled: false }).kind).toBe("unavailable");
  });

  it("uses real SMS when configured", () => {
    const sms: PhoneVerifier = {
      kind: "sms",
      start: async () => ({ ok: true }),
      check: async () => ({ ok: true }),
    };
    expect(choosePhoneVerifier({ siteEnv: "production", smsEnabled: true, sms }).kind).toBe("sms");
  });
});
