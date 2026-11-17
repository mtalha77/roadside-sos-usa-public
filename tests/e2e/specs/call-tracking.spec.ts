import { createHmac, randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, readOnly, test } from "../support/fixtures";

// RSOS-030 on previews (no Twilio keys): webhooks accept only requests signed with the token for
// this environment (the published test token outside production), are idempotent, and walk the
// call flow; the website remembers the visit's source for number insertion.

const FAKE_TOKEN = "fake-twilio-auth-token-for-tests";
const sign = (url: string, params: Record<string, string>) =>
  createHmac("sha1", FAKE_TOKEN)
    .update(
      Object.keys(params)
        .sort()
        .reduce((acc, k) => acc + k + params[k], url),
    )
    .digest("base64");

async function postTwilio(
  request: APIRequestContext,
  url: string,
  params: Record<string, string>,
  signed = true,
) {
  return request.post(url, {
    form: params,
    headers: signed ? { "X-Twilio-Signature": sign(url, params) } : {},
  });
}

const callSid = () => `CA${randomBytes(16).toString("hex")}`;
// Fictional 555-01xx numbers.
const newTrackingNumber = () =>
  `+1210555${String(100 + Math.floor(Math.random() * 99)).padStart(4, "0")}`;
const trackingNumber = "+12105550197";

test.describe("Twilio voice webhooks", () => {
  test.skip(!appUrls.admin, "No admin URL");

  test("unsigned or wrongly signed requests get 403", async ({ request }) => {
    const url = new URL("/api/twilio/voice", appUrls.admin).toString();
    const params = { CallSid: callSid(), From: "+12105550123", To: trackingNumber };
    expect((await postTwilio(request, url, params, false)).status()).toBe(403);
    const res = await request.post(url, {
      form: params,
      headers: { "X-Twilio-Signature": sign(url, { ...params, From: "+12105550999" }) },
    });
    expect(res.status()).toBe(403);
    for (const path of ["dial", "status", "recording", "transcription"])
      expect(
        (
          await postTwilio(
            request,
            new URL(`/api/twilio/voice/${path}`, appUrls.admin).toString(),
            params,
            false,
          )
        ).status(),
      ).toBe(403);
  });

  test("a call to a tracking number greets, rings, falls back and goes to voicemail", async ({
    page,
    request,
  }) => {
    test.skip(readOnly, "Writes to the database");
    test.setTimeout(120_000);
    const trackingNumber = newTrackingNumber();
    // A super admin adds a staging test number for the first market.
    await signInAsDemo(page, appUrls.admin!, "Super admin");
    await page.goto(new URL("/settings?tab=phones", appUrls.admin).toString());
    await page.getByLabel("Number").fill(trackingNumber);
    await page.getByLabel("Source").selectOption("staging_test");
    await page.getByRole("button", { name: "Add number" }).click();
    await expect(page.getByText(`Added ${trackingNumber}.`)).toBeVisible();

    const voice = new URL("/api/twilio/voice", appUrls.admin).toString();
    const sid = callSid();
    const params = {
      CallSid: sid,
      From: "+12105550123",
      To: trackingNumber,
      CallStatus: "ringing",
    };
    const first = await postTwilio(request, voice, params);
    expect(first.status()).toBe(200);
    const twiml = await first.text();
    expect(twiml).toContain("<Response>");
    expect(twiml).toMatch(/hang up and call 9 1 1/);
    // A repeated delivery answers the same way (and creates nothing new).
    const again = await postTwilio(request, voice, params);
    expect(await again.text()).toContain("hang up and call 9 1 1");

    // Nobody answered in the browser, nor on mobiles: voicemail with transcription.
    const dial = new URL("/api/twilio/voice/dial", appUrls.admin);
    dial.searchParams.set("leg", "clients");
    const leg1 = await postTwilio(request, dial.toString(), {
      CallSid: sid,
      DialCallStatus: "no-answer",
    });
    expect(await leg1.text()).toMatch(/<Dial|<Redirect/);
    dial.searchParams.set("leg", "numbers");
    const leg2 = await postTwilio(request, dial.toString(), {
      CallSid: sid,
      DialCallStatus: "no-answer",
    });
    const vm = await leg2.text();
    expect(vm).toContain("<Record");
    expect(vm).toContain('transcribe="true"');

    const status = new URL("/api/twilio/voice/status", appUrls.admin).toString();
    expect(
      (
        await postTwilio(request, status, {
          CallSid: sid,
          CallStatus: "completed",
          CallDuration: "42",
        })
      ).status(),
    ).toBe(204);

    // An unknown number hangs up politely.
    const unknown = await postTwilio(request, voice, {
      CallSid: callSid(),
      From: "+12105550123",
      To: "+12105550198",
    });
    expect(await unknown.text()).toContain("<Hangup/>");
  });
});

test.describe("call tracking on the website", () => {
  test.skip(!appUrls.web, "No website URL");

  test("an ad visit remembers its source and the phone endpoint answers", async ({
    page,
    context,
    request,
  }) => {
    await page.goto(new URL("/?gclid=e2e-test", appUrls.web).toString());
    const cookie = (await context.cookies()).find((c) => c.name === "rsos_src");
    expect(cookie?.value).toBe("google_ads");
    expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(80 * 24 * 3600);
    // A later visit with other parameters keeps the first touch.
    await page.goto(new URL("/?utm_source=bing", appUrls.web).toString());
    expect((await context.cookies()).find((c) => c.name === "rsos_src")?.value).toBe("google_ads");
    const bad = await request.get(
      new URL("/api/phone?market=x&source=nope", appUrls.web).toString(),
    );
    expect(bad.status()).toBe(400);
  });
});
