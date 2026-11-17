import { createHmac, randomBytes } from "node:crypto";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, readOnly, test } from "../support/fixtures";

// RSOS-023 on previews: the dispatcher texts a location link (fake Twilio records the text), the
// driver opens it, shares GPS, and the request's location and timeline update in the inbox.

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

  test("a texted link shares the driver's GPS location with the dispatcher", async ({
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
    await page.getByLabel("Number").fill(tracking);
    await page.getByLabel("Source").selectOption("staging_test");
    await page.getByRole("button", { name: "Add number" }).click();
    await expect(page.getByText(`Added ${tracking}.`)).toBeVisible();

    const url = new URL("/api/twilio/messages", appUrls.admin).toString();
    const params = {
      MessageSid: `SM${randomBytes(16).toString("hex")}`,
      From: driver,
      To: tracking,
      Body: "Need a tow please",
    };
    await request.post(url, { form: params, headers: { "X-Twilio-Signature": sign(url, params) } });

    await page.goto(new URL("/inbox", appUrls.admin).toString());
    await page
      .getByRole("link", { name: new RegExp(driver.slice(-4)) })
      .first()
      .click({ timeout: 30_000 });
    const panel = page.getByRole("article");
    await panel.getByRole("button", { name: "Send location link" }).click();
    const sent = panel.getByText(/\/l\/[A-Za-z0-9_-]{22,}/).first();
    await expect(sent).toBeVisible();
    const token = /\/l\/([A-Za-z0-9_-]{22,})/.exec((await sent.textContent()) ?? "")![1]!;

    // The driver opens the link on their phone, with location allowed.
    const phone = await browser.newContext({
      geolocation: { latitude: 29.7604, longitude: -95.3698 },
      permissions: ["geolocation"],
      viewport: { width: 375, height: 812 },
    });
    const driverPage = await phone.newPage();
    const res = await driverPage.goto(new URL(`/l/${token}`, appUrls.web).toString());
    expect(res?.status()).toBe(200);
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
