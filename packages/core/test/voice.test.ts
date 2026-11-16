import { describe, expect, it } from "vitest";
import {
  FAKE_TWILIO_AUTH_TOKEN,
  chooseLookup,
  chooseTexts,
  createFakeTexts,
  createTwilioLookup,
  createTwilioTexts,
  fallbackCallTwiml,
  fakeLookup,
  incomingCallTwiml,
  nextLeg,
  numberForVisit,
  outboundCallTwiml,
  segmentCount,
  sourceForVisit,
  voicemailTwiml,
  webhookAuthToken,
  withQuery,
} from "../src/adapters";

const text = {
  greeting: "Thanks for calling Test & Co.",
  safety: "If you are in danger, hang up and call 9 1 1.",
  recordingNotice: "This call may be recorded.",
  voicemail: "Leave a message.",
  goodbye: "Bye.",
};
const action = "https://admin.example.test/api/twilio/voice/dial?x-vercel-protection-bypass=abc";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("call flow TwiML", () => {
  it("greets, gives the safety line and rings every available browser", () => {
    const x = incomingCallTwiml({ text, record: false, clients: ["u_a", "u_b"], action });
    expect(x.startsWith('<?xml version="1.0" encoding="UTF-8"?><Response>')).toBe(true);
    expect(x).toContain("Test &amp; Co.");
    expect(x.indexOf("danger")).toBeGreaterThan(x.indexOf("Thanks"));
    expect(x).toContain("<Client>u_a</Client><Client>u_b</Client>");
    expect(x).not.toContain("recorded");
    expect(x).not.toContain("record=");
    // The bypass parameter survives and the leg is added.
    expect(x).toContain("x-vercel-protection-bypass=abc&amp;leg=clients");
  });

  it("speaks the recording notice and records only where enabled", () => {
    const x = incomingCallTwiml({
      text,
      record: true,
      clients: ["u_a"],
      action,
      recordingStatusCallback: "https://admin.example.test/api/twilio/voice/recording",
    });
    expect(x).toContain("This call may be recorded.");
    expect(x).toContain('record="record-from-answer-dual"');
  });

  it("skips straight to the next leg when nobody is available", () => {
    expect(incomingCallTwiml({ text, record: false, clients: [], action })).toContain(
      "leg=clients&amp;none=1</Redirect>",
    );
    expect(
      fallbackCallTwiml({ numbers: [], callerId: "+12105550199", action, record: false }),
    ).toContain("leg=numbers&amp;none=1");
  });

  it("rings mobiles with our number as caller ID, then voicemail with transcription", () => {
    const f = fallbackCallTwiml({
      numbers: ["+12105550101"],
      callerId: "+12105550199",
      action,
      record: false,
    });
    expect(f).toContain('callerId="+12105550199"');
    expect(f).toContain("<Number>+12105550101</Number>");
    const v = voicemailTwiml({
      text,
      recordingStatusCallback: "https://a.test/r",
      transcribeCallback: "https://a.test/t",
    });
    expect(v).toContain('transcribe="true"');
    expect(v).toContain("Leave a message.");
    expect(
      outboundCallTwiml({
        to: "+12105550101",
        callerId: "+12105550199",
        statusCallback: "https://a.test/s",
      }),
    ).toContain('callerId="+12105550199"');
  });

  it("chooses the next leg from the Dial result", () => {
    expect(nextLeg("clients", "completed")).toBe("done");
    expect(nextLeg("clients", "no-answer")).toBe("numbers");
    expect(nextLeg("numbers", "busy")).toBe("voicemail");
    expect(nextLeg("numbers", null)).toBe("voicemail");
    expect(withQuery("https://a.test/x?y=1", { z: "2" })).toBe("https://a.test/x?y=1&z=2");
  });
});

describe("call tracking and dynamic number insertion", () => {
  it("classifies the source of a visit", () => {
    expect(sourceForVisit({ gclid: "abc" })).toBe("google_ads");
    expect(sourceForVisit({ utm_source: "google" })).toBe("google_ads");
    expect(sourceForVisit({ utm_source: "gmb" })).toBe("gmb");
    expect(sourceForVisit({ fbclid: "x" })).toBe("meta");
    expect(sourceForVisit({ utm_source: "bing" })).toBe("bing");
    expect(sourceForVisit({ msclkid: "x" })).toBe("bing");
    expect(sourceForVisit({})).toBe("website");
  });

  it("shows the source's number, else the website number, else the fallback", () => {
    const numbers = [
      { phone: "+12105550110", source: "website" as const, active: true },
      { phone: "+12105550111", source: "google_ads" as const, active: true },
      { phone: "+12105550112", source: "meta" as const, active: false },
    ];
    expect(numberForVisit(numbers, "google_ads", null)).toBe("+12105550111");
    expect(numberForVisit(numbers, "meta", null)).toBe("+12105550110");
    expect(numberForVisit([], "meta", "+12105550113")).toBe("+12105550113");
  });
});

describe("texts, lookup and webhook token", () => {
  it("counts SMS segments", () => {
    expect(segmentCount("")).toBe(0);
    expect(segmentCount("a".repeat(160))).toBe(1);
    expect(segmentCount("a".repeat(161))).toBe(2);
    expect(segmentCount("é ok")).toBe(1);
    expect(segmentCount("🚗".repeat(71))).toBe(2);
  });

  it("the fake records texts and returns a well-formed SID", async () => {
    const t = createFakeTexts();
    const r = await t.send({ to: "+12105550101", body: "hi" });
    expect(r.ok && /^SM[0-9a-f]{32}$/.test(r.sid)).toBe(true);
    expect(t.outbox).toHaveLength(1);
    expect((await t.send({ to: "bad", body: "hi" })).ok).toBe(false);
    expect(chooseTexts({}).mode).toBe("fake");
  });

  it("the real sender posts to the Messaging Service and reads errors", async () => {
    let body = "";
    const ok = createTwilioTexts(
      { accountSid: "AC1", authToken: "t", messagingServiceSid: "MG1" },
      (async (_u: unknown, init?: RequestInit) => {
        body = String(init?.body);
        return json({ sid: `SM${"a".repeat(32)}`, num_segments: "1" }, 201);
      }) as unknown as typeof fetch,
    );
    expect(
      await ok.send({ to: "+12105550101", body: "hi", statusCallback: "https://a.test/s" }),
    ).toEqual({
      ok: true,
      sid: `SM${"a".repeat(32)}`,
      segments: 1,
    });
    expect(body).toContain("MessagingServiceSid=MG1");
    expect(body).toContain("StatusCallback=");
    const bad = createTwilioTexts(
      { accountSid: "AC1", authToken: "t", messagingServiceSid: "MG1" },
      (async () => json({ code: 21610 }, 400)) as unknown as typeof fetch,
    );
    expect(await bad.send({ to: "+12105550101", body: "hi" })).toEqual({
      ok: false,
      reason: "error",
      code: 21610,
    });
    expect((await bad.send({ to: "x", body: "hi" })).ok).toBe(false);
  });

  it("looks up line types", async () => {
    const l = createTwilioLookup({ accountSid: "AC1", authToken: "t" }, (async () =>
      json({ line_type_intelligence: { type: "mobile" } })) as unknown as typeof fetch);
    expect(await l.lineType("+12105550101")).toBe("mobile");
    expect(await l.lineType("bad")).toBe("unknown");
    const voip = createTwilioLookup({ accountSid: "AC1", authToken: "t" }, (async () =>
      json({ line_type_intelligence: { type: "nonFixedVoip" } })) as unknown as typeof fetch);
    expect(await voip.lineType("+12105550101")).toBe("voip");
    expect(await fakeLookup.lineType("+12105550101")).toBe("mobile");
    expect(chooseLookup({}).mode).toBe("fake");
  });

  it("production never accepts the published test token", () => {
    expect(webhookAuthToken({ NEXT_PUBLIC_SITE_ENV: "staging" })).toBe(FAKE_TWILIO_AUTH_TOKEN);
    expect(webhookAuthToken({ NEXT_PUBLIC_SITE_ENV: "production" })).toBeNull();
    expect(
      webhookAuthToken({ NEXT_PUBLIC_SITE_ENV: "production", TWILIO_AUTH_TOKEN: "real" }),
    ).toBe("real");
  });
});
