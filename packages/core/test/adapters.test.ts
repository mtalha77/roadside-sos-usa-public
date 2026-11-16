import { describe, expect, it, vi } from "vitest";
import {
  FAKE_VERIFY_CODE,
  chooseMaps,
  chooseVerify,
  createFakeMaps,
  createFakeVerify,
  createGoogleMaps,
  createTwilioVerify,
  estimateRoute,
  highwayFrom,
  twilioSignature,
  validateTwilioSignature,
  verifyAvailable,
} from "../src/adapters";

const phone = "+12105550123"; // fictional 555-01xx number
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Twilio Verify adapter", () => {
  it("fake: fixed code, nothing sent", async () => {
    const v = createFakeVerify();
    expect(await v.start(phone)).toEqual({ ok: true, demoCode: FAKE_VERIFY_CODE });
    expect(await v.start("123")).toEqual({ ok: false, reason: "invalid-phone" });
    expect(await v.check(phone, FAKE_VERIFY_CODE)).toEqual({ ok: true });
    expect(await v.check(phone, "111111")).toEqual({ ok: false, reason: "invalid-code" });
    expect(await v.check("bad", FAKE_VERIFY_CODE)).toEqual({ ok: false, reason: "error" });
  });

  it("real: calls Verify with form bodies and reads the status", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body) });
      if (String(url).endsWith("/Verifications")) return json({ status: "pending" }, 201);
      return json({ status: String(init?.body).includes("Code=123456") ? "approved" : "pending" });
    }) as unknown as typeof fetch;
    const v = createTwilioVerify(
      { accountSid: "AC1", authToken: "t", serviceSid: "VA1" },
      fetchImpl,
    );
    expect(await v.start(phone)).toEqual({ ok: true });
    expect(calls[0]!.url).toBe("https://verify.twilio.com/v2/Services/VA1/Verifications");
    expect(calls[0]!.body).toContain("Channel=sms");
    expect(await v.check(phone, "123456")).toEqual({ ok: true });
    expect(await v.check(phone, "654321")).toEqual({ ok: false, reason: "invalid-code" });
    expect(await v.check(phone, "x")).toEqual({ ok: false, reason: "invalid-code" });
  });

  it("real: expired checks, HTTP errors and network failures", async () => {
    const mk = (res: () => Promise<Response>) =>
      createTwilioVerify({ accountSid: "AC1", authToken: "t", serviceSid: "VA1" }, (async () =>
        res()) as unknown as typeof fetch);
    expect(await mk(async () => json({}, 404)).check(phone, "123456")).toEqual({
      ok: false,
      reason: "invalid-code",
    });
    expect(await mk(async () => json({}, 500)).check(phone, "123456")).toEqual({
      ok: false,
      reason: "error",
    });
    expect(await mk(async () => json({ nope: 1 })).check(phone, "123456")).toEqual({
      ok: false,
      reason: "error",
    });
    expect(await mk(async () => json({}, 500)).start(phone)).toEqual({
      ok: false,
      reason: "error",
    });
    const boom = mk(async () => {
      throw new Error("down");
    });
    expect(await boom.start(phone)).toEqual({ ok: false, reason: "error" });
    expect(await boom.check(phone, "123456")).toEqual({ ok: false, reason: "error" });
    expect(await boom.start("bad")).toEqual({ ok: false, reason: "invalid-phone" });
  });

  it("chooses real only with keys, and production never uses the fake", () => {
    expect(chooseVerify({}).mode).toBe("fake");
    expect(
      chooseVerify({
        TWILIO_ACCOUNT_SID: "AC",
        TWILIO_AUTH_TOKEN: "t",
        TWILIO_VERIFY_SERVICE_SID: "VA",
      }).mode,
    ).toBe("real");
    expect(verifyAvailable(createFakeVerify(), { NEXT_PUBLIC_SITE_ENV: "staging" })).toBe(true);
    expect(verifyAvailable(createFakeVerify(), { NEXT_PUBLIC_SITE_ENV: "production" })).toBe(false);
  });
});

describe("Twilio webhook signatures", () => {
  const url = "https://example.test/api/twilio/voice";
  const params = { CallSid: "CA1", From: phone, To: "+12105550199" };
  it("accepts the right signature and rejects anything else", () => {
    const sig = twilioSignature("secret", url, params);
    expect(validateTwilioSignature("secret", url, params, sig)).toBe(true);
    expect(validateTwilioSignature("secret", url, { ...params, From: "+1" }, sig)).toBe(false);
    expect(validateTwilioSignature("other", url, params, sig)).toBe(false);
    expect(validateTwilioSignature("secret", url, params, null)).toBe(false);
    expect(validateTwilioSignature(undefined, url, params, sig)).toBe(false);
    expect(validateTwilioSignature("secret", url, params, "short")).toBe(false);
  });
  it("matches Twilio's documented example", () => {
    // From Twilio's security docs (example values, not a real account).
    const sig = twilioSignature("12345", "https://mycompany.com/myapp.php?foo=1&bar=2", {
      CallSid: "CA1234567890ABCDE",
      Caller: "+12349013030",
      Digits: "1234",
      From: "+12349013030",
      To: "+18005551212",
    });
    expect(sig).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
  });
});

describe("Maps adapter", () => {
  it("fake: echoes a suggestion at the bias point and estimates routes", async () => {
    const m = createFakeMaps();
    expect(await m.autocomplete("ab", {})).toEqual([]);
    const [s] = await m.autocomplete("1200 Main St", { bias: { lat: 29.4, lng: -98.5 } });
    expect(s!.text).toBe("1200 Main St");
    expect(await m.place(s!.placeId)).toEqual({ lat: 29.4, lng: -98.5, address: "1200 Main St" });
    expect(await m.place("other")).toBeNull();
    expect(await m.reverseGeocode({ lat: 1, lng: 1 })).toBeNull();
    const r = await m.route({ lat: 29.4, lng: -98.5 }, { lat: 29.5, lng: -98.5 });
    expect(r).toEqual(estimateRoute({ lat: 29.4, lng: -98.5 }, { lat: 29.5, lng: -98.5 }));
    expect(r!.meters).toBeGreaterThan(14000);
    expect(chooseMaps({}).mode).toBe("fake");
    expect(chooseMaps({ GOOGLE_MAPS_SERVER_KEY: "k" }).mode).toBe("real");
  });

  it("finds highway names", () => {
    expect(highwayFrom("Interstate 35 Frontage Rd")).toBe("I-35");
    expect(highwayFrom("I-10 W")).toBe("I-10");
    expect(highwayFrom("US 90 Alt")).toBe("US-90");
    expect(highwayFrom("Loop 410")).toBe("Loop 410");
    expect(highwayFrom("State Highway 6")).toBe("Hwy 6");
    expect(highwayFrom("Main St")).toBeNull();
  });

  it("real: parses Places, Geocoding and Routes responses", async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("places:autocomplete"))
        return json({
          suggestions: [
            {
              placePrediction: {
                placeId: "ChIJabcdefghij",
                text: { text: "1200 Main St, Test City" },
                structuredFormat: {
                  mainText: { text: "1200 Main St" },
                  secondaryText: { text: "Test City" },
                },
              },
            },
            {},
          ],
        });
      if (u.includes("/v1/places/"))
        return json({ formattedAddress: "1200 Main St", location: { latitude: 1, longitude: 2 } });
      if (u.includes("geocode"))
        return json({
          status: "OK",
          results: [
            {
              formatted_address: "I-35 Frontage Rd",
              address_components: [{ long_name: "Interstate 35", types: ["route"] }],
            },
          ],
        });
      if (u.includes("computeRoutes"))
        return json({ routes: [{ distanceMeters: 8000, duration: "600s" }] });
      return json({}, 404);
    }) as unknown as typeof fetch;
    const g = createGoogleMaps("k", fetchImpl);
    expect(await g.autocomplete("12", {})).toEqual([]);
    expect(
      await g.autocomplete("1200 Main", { bias: { lat: 1, lng: 2 }, sessionToken: "s" }),
    ).toEqual([{ placeId: "ChIJabcdefghij", text: "1200 Main St", secondary: "Test City" }]);
    expect(await g.place("ChIJabcdefghij", { sessionToken: "s" })).toEqual({
      address: "1200 Main St",
      lat: 1,
      lng: 2,
    });
    expect(await g.place("bad id!")).toBeNull();
    expect(await g.reverseGeocode({ lat: 1, lng: 2 })).toEqual({
      address: "I-35 Frontage Rd",
      highway: "I-35",
    });
    expect(await g.route({ lat: 1, lng: 2 }, { lat: 1, lng: 3 })).toEqual({
      meters: 8000,
      seconds: 600,
    });
  });

  it("real: failures become empty results", async () => {
    const g = createGoogleMaps("k", (async () => json({}, 500)) as unknown as typeof fetch);
    expect(await g.autocomplete("1200 Main", {})).toEqual([]);
    expect(await g.place("ChIJabcdefghij")).toBeNull();
    expect(await g.reverseGeocode({ lat: 1, lng: 2 })).toBeNull();
    expect(await g.route({ lat: 1, lng: 2 }, { lat: 1, lng: 3 })).toBeNull();
    const empty = createGoogleMaps("k", (async () =>
      json({ status: "ZERO_RESULTS", results: [], routes: [{}] })) as unknown as typeof fetch);
    expect(await empty.reverseGeocode({ lat: 1, lng: 2 })).toBeNull();
    expect(await empty.route({ lat: 1, lng: 2 }, { lat: 1, lng: 3 })).toBeNull();
  });
});

describe("rate limit stores", () => {
  it("uses the durable store, and memory when it fails", async () => {
    const { getRateLimitStore, checkRateLimits } = await import("../src/security");
    let n = 0;
    const durable = { increment: async () => ++n };
    const store = getRateLimitStore({}, durable);
    expect(await store.increment("k", 60)).toBe(1);
    expect(
      (await checkRateLimits([{ key: "a", limit: 1, windowSeconds: 60 }], store)).allowed,
    ).toBe(false);
    const broken = getRateLimitStore(
      {},
      {
        increment: async () => {
          throw new Error("down");
        },
      },
    );
    expect(await broken.increment("x-fallback", 60)).toBe(1);
    expect(
      getRateLimitStore({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" }, durable),
    ).not.toBe(durable);
  });
});
