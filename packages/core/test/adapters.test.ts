import { describe, expect, it } from "vitest";
import {
  averageSpeedMph,
  chooseMaps,
  createFakeMaps,
  createGoogleMaps,
  estimateRoute,
  highwayFrom,
  isPlausibleAddress,
  mapsEnabled,
  twilioSignature,
  validateTwilioSignature,
} from "../src/adapters";

const phone = "+12105550123"; // fictional 555-01xx number
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

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
    // 0.1 degree of latitude is about 11.1 km straight line; 30 mph default is about 13 minutes.
    expect(r!.meters).toBeGreaterThan(11000);
    expect(r!.meters).toBeLessThan(11200);
    expect(Math.round(r!.seconds / 60)).toBe(14);
  });

  it("stays the dummy until keys and the flag are both set", () => {
    const keys = { GOOGLE_MAPS_SERVER_KEY: "k", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "b" };
    expect(chooseMaps({}).mode).toBe("fake");
    expect(chooseMaps(keys).mode).toBe("fake");
    expect(chooseMaps({ MAPS_ENABLED: "true", GOOGLE_MAPS_SERVER_KEY: "k" }).mode).toBe("fake");
    expect(chooseMaps({ ...keys, MAPS_ENABLED: "true" }).mode).toBe("real");
    expect(mapsEnabled({ ...keys, MAPS_ENABLED: "1" })).toBe(false);
  });

  it("ETA uses the configured average speed", () => {
    expect(averageSpeedMph({})).toBe(30);
    expect(averageSpeedMph({ MAPS_AVG_SPEED_MPH: "45" })).toBe(45);
    expect(averageSpeedMph({ MAPS_AVG_SPEED_MPH: "500" })).toBe(30);
    const a = { lat: 29.4, lng: -98.5 };
    const b = { lat: 29.5, lng: -98.5 };
    expect(estimateRoute(a, b, 60).seconds * 2).toBeCloseTo(estimateRoute(a, b, 30).seconds, -1);
  });

  it("checks typed address formats without geocoding", () => {
    for (const ok of [
      "1200 Main St",
      "I-35 mile marker 160",
      "Main St and 5th St",
      "Exit 12 on US-90",
    ])
      expect(isPlausibleAddress(ok)).toBe(true);
    for (const bad of ["", "abc", "12345", "hello there"])
      expect(isPlausibleAddress(bad)).toBe(false);
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
