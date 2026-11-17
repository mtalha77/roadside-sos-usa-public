import { describe, expect, it } from "vitest";
import {
  chooseTexts,
  createFakeTexts,
  inQuietHours,
  keywordOf,
  textDecision,
  textingEnabled,
} from "../src/adapters";

const keys = {
  TWILIO_ACCOUNT_SID: "AC1",
  TWILIO_AUTH_TOKEN: "t",
  TWILIO_MESSAGING_SERVICE_SID: "MG1",
};

describe("texting (off in batch 4)", () => {
  it("is off unless TEXTING_ENABLED is exactly true, and stays fake without the flag", () => {
    expect(textingEnabled({})).toBe(false);
    expect(textingEnabled({ TEXTING_ENABLED: "1" })).toBe(false);
    expect(textingEnabled({ TEXTING_ENABLED: "true" })).toBe(true);
    expect(chooseTexts(keys).mode).toBe("fake");
    expect(chooseTexts({ ...keys, TEXTING_ENABLED: "true" }).mode).toBe("real");
  });

  it("the fake records texts and sends nothing", async () => {
    const fake = createFakeTexts();
    const r = await fake.send({ to: "+12105550123", body: "Test" });
    expect(r.ok).toBe(true);
    expect(fake.outbox).toEqual([{ to: "+12105550123", body: "Test" }]);
  });

  it("reads opt-out keywords", () => {
    expect(keywordOf(" stop ")).toBe("stop");
    expect(keywordOf("Unsubscribe.")).toBe("stop");
    expect(keywordOf("START")).toBe("start");
    expect(keywordOf("help!")).toBe("help");
    expect(keywordOf("please stop by soon")).toBeNull();
  });

  it("knows quiet hours in the market's time zone", () => {
    // 03:00 UTC is 21:00 or 22:00 in Chicago depending on daylight time: quiet either way.
    expect(inQuietHours("America/Chicago", new Date("2026-11-17T03:00:00Z"))).toBe(true);
    expect(inQuietHours("America/Chicago", new Date("2026-11-17T18:00:00Z"))).toBe(false);
  });

  it("decides in order: off, opted out, quiet hours, A2P", () => {
    const base = {
      enabled: true,
      optedOut: false,
      urgent: false,
      quietHours: false,
      realSend: true,
      a2pApproved: true,
      testNumber: false,
    };
    expect(textDecision({ ...base, enabled: false })).toBe("disabled");
    expect(textDecision({ ...base, optedOut: true, urgent: true })).toBe("blocked");
    expect(textDecision({ ...base, quietHours: true })).toBe("quiet_hours");
    expect(textDecision({ ...base, quietHours: true, urgent: true })).toBe("send");
    expect(textDecision({ ...base, a2pApproved: false })).toBe("a2p_pending");
    expect(textDecision({ ...base, a2pApproved: false, testNumber: true })).toBe("send");
    expect(textDecision(base)).toBe("send");
  });
});
