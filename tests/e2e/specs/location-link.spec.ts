import { createHmac, randomBytes } from "node:crypto";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, readOnly, test } from "../support/fixtures";

// RSOS-023 on previews (no SMS in batch 4): a missed call opens a phone request without an email,
// so the dispatcher reads a 6-digit code on the call; the driver types it at /l, shares GPS, and
// the request's location and timeline update in the inbox.

const FAKE_TOKEN = "fake-twilio-auth-token-for-tests";
const sign = (url: string, params: Record<string, string>) =>
  createHmac("sha1", FAKE_TOKEN)
    .update(
      Object.keys(params)
        .sort()
        .reduce((acc, k) => acc + k + params[k], url),
    )
    .digest("base64");
const fake555 = () => `+1210555${String(Math.floor(Math.random() * 1000)).padStart(4, "0")}`;

test.describe("location link", () => {
  test.skip(!appUrls.admin || !appUrls.web, "Needs admin and website URLs");

  test("a code read on the call shares the driver's GPS location with the dispatcher", async ({
    page,
    browser,
    request,
  }, info) => {
    test.skip(readOnly, "Writes to the database");
    test.skip(info.project.name !== "desktop-chrome", "One browser is enough for this flow");
    test.setTimeout(180_000);
    await signInAsDemo(page, appUrls.admin!, "Super admin");
    const tracking = fake555();
    const driver = fake555();
    await page.goto(new URL("/settings?tab=phones", appUrls.admin).toString());
    await page.getByRole("textbox", { name: "Number", exact: true }).fill(tracking);
    await page.getByLabel("Source").selectOption("staging_test");
    await page.getByRole("button", { name: "Add number" }).click();
    await expect(
      page.getByText(`Added ${tracking}.`).or(page.getByText("That number is already tracked.")),
    ).toBeVisible();

    // A missed call from the driver opens an urgent phone request.
    const post = (path: string, params: Record<string, string>) => {
      const url = new URL(path, appUrls.admin).toString();
      return request.post(url, {
        form: params,
        headers: { "X-Twilio-Signature": sign(url, params) },
      });
    };
    const CallSid = `CA${randomBytes(16).toString("hex")}`;
    await post("/api/twilio/voice", { CallSid, From: driver, To: tracking, CallStatus: "ringing" });
    await post("/api/twilio/voice/status", { CallSid, CallStatus: "completed", CallDuration: "5" });

    await page.goto(new URL("/inbox", appUrls.admin).toString());
    await page
      .getByRole("link", { name: new RegExp(driver.slice(-4)) })
      .first()
      .click({ timeout: 30_000 });
    const panel = page.getByRole("article");
    await panel.getByRole("button", { name: "Location link" }).click();
    const script = panel.getByText(/and type the code \d{3} \d{3}/);
    await expect(script).toBeVisible();
    const code = /code (\d{3}) (\d{3})/.exec((await script.textContent()) ?? "")!;
    await panel.getByRole("button", { name: "I read it to the driver" }).click();
    await expect(panel.getByText("Logged on the timeline.")).toBeVisible();

    // The driver opens the link on their phone, with location allowed.
    const phone = await browser.newContext({
      geolocation: { latitude: 29.7604, longitude: -95.3698 },
      permissions: ["geolocation"],
      viewport: { width: 375, height: 812 },
    });
    const driverPage = await phone.newPage();
    const res = await driverPage.goto(new URL("/l", appUrls.web).toString());
    expect(res?.status()).toBe(200);
    await expectNoA11yViolations(driverPage);
    // A wrong code is refused; the one read on the call opens the location page.
    await driverPage.getByLabel("6-digit code").fill("000000");
    await driverPage.getByRole("button", { name: "Continue" }).click();
    await expect(driverPage.getByText(/That code didn't work/)).toBeVisible();
    await driverPage.getByLabel("6-digit code").fill(`${code[1]} ${code[2]}`);
    await driverPage.getByRole("button", { name: "Continue" }).click();
    await expect(driverPage).toHaveURL(/\/l\/[A-Za-z0-9_-]{22,}$/);
    // Almost no JavaScript before the map: one small inline script.
    const scripts = await driverPage.locator("script[src]").count();
    expect(scripts).toBe(0);
    await expectNoA11yViolations(driverPage);
    await driverPage.getByRole("button", { name: "Share my location" }).click();
    await expect(driverPage.getByText(/Found you at 29\.76/)).toBeVisible();
    await driverPage.getByLabel("Landmark (optional)").fill("By the gas station");
    await driverPage.getByRole("button", { name: "Send my location" }).click();
    await expect(
      driverPage.getByRole("heading", { name: "Thanks, we have your location" }),
    ).toBeVisible();
    await phone.close();

    // The dispatcher sees it on the timeline (live, or after a reload).
    await expect(async () => {
      await page.reload();
      await expect(panel.getByText("Driver shared location").first()).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 30_000 });

    // A made-up or expired token gets the friendly expired page.
    const bad = await request.get(
      new URL("/l/not-a-real-token-but-long-enough", appUrls.web).toString(),
    );
    expect(bad.status()).toBe(410);
  });
});
