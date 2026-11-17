import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  holdTwiml,
  ringClientTwiml,
  softphoneConfig,
  updateLiveCall,
  voiceAccessToken,
} from "../src/adapters";

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("softphone access token", () => {
  const o = {
    accountSid: "AC_test",
    apiKeySid: "SK_test",
    apiKeySecret: "secret",
    twimlAppSid: "AP_test",
    identity: "u_abc",
    now: 1_800_000_000_000,
  };
  it("is a Twilio Voice JWT for one dispatcher, valid for one hour", () => {
    const jwt = voiceAccessToken(o);
    const [h, p, sig] = jwt.split(".");
    expect(decode(h!)).toEqual({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" });
    const payload = decode(p!);
    expect(payload.iss).toBe("SK_test");
    expect(payload.sub).toBe("AC_test");
    expect(payload.exp - payload.iat).toBe(3600);
    expect(payload.grants).toEqual({
      identity: "u_abc",
      voice: { incoming: { allow: true }, outgoing: { application_sid: "AP_test" } },
    });
    expect(sig).toBe(createHmac("sha256", "secret").update(`${h}.${p}`).digest("base64url"));
  });

  it("needs all four keys to be real", () => {
    expect(softphoneConfig({}).mode).toBe("fake");
    expect(
      softphoneConfig({
        TWILIO_ACCOUNT_SID: "a",
        TWILIO_API_KEY_SID: "k",
        TWILIO_API_KEY_SECRET: "s",
        TWILIO_TWIML_APP_SID: "app",
      }).mode,
    ).toBe("real");
  });
});

describe("live call control", () => {
  it("hold and resume TwiML", () => {
    expect(holdTwiml("https://a.test/m.mp3")).toContain(
      '<Play loop="0">https://a.test/m.mp3</Play>',
    );
    expect(ringClientTwiml("u_x")).toContain("<Client>u_x</Client>");
  });
  it("updates a live call through the REST API", async () => {
    let url = "";
    const ok = await updateLiveCall(
      { accountSid: "AC1", authToken: "t" },
      `CA${"b".repeat(32)}`,
      "<Response/>",
      (async (u: string | URL | Request) => {
        url = String(u);
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    );
    expect(ok).toBe(true);
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/AC1/Calls/CA${"b".repeat(32)}.json`,
    );
    expect(await updateLiveCall({ accountSid: "AC1", authToken: "t" }, "bad", "<Response/>")).toBe(
      false,
    );
    const down = await updateLiveCall(
      { accountSid: "AC1", authToken: "t" },
      `CA${"b".repeat(32)}`,
      "x",
      (async () => {
        throw new Error("down");
      }) as unknown as typeof fetch,
    );
    expect(down).toBe(false);
  });
});
