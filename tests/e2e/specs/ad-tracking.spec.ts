import { answerScreenOne } from "../support/get-help";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, readOnly, test } from "../support/fixtures";

// RSOS-031 acceptance on previews: a visit with a (fake) gclid produces a request that carries it
// into the Google Ads offline conversion file; no Google Tag Manager before consent.

test.describe("ad tracking and attribution", () => {
  test.skip(!appUrls.web || !appUrls.admin, "Needs website and admin URLs");

  test("a gclid visit reaches the offline conversion file", async ({ browser, page }, info) => {
    test.skip(readOnly, "Writes to the database");
    test.skip(info.project.name !== "desktop-chrome", "One browser is enough for this flow");
    test.setTimeout(180_000);
    const gclid = `E2E-TEST-GCLID-${Date.now()}`;
    const driver = await browser.newContext();
    const web = await driver.newPage();
    await web.goto(new URL(`/?gclid=${gclid}&utm_source=google`, appUrls.web).toString());
    // First touch is stored; no tag manager without a consent choice.
    const cookies = await driver.cookies();
    expect(cookies.find((c) => c.name === "rsos_src")?.value).toBe("google_ads");
    expect(cookies.find((c) => c.name === "rsos_attr")?.httpOnly).toBe(true);
    await expect(web.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);

    // The driver browses to Get Help later (no gclid in that URL) and sends a request.
    await web.goto(new URL("/get-help", appUrls.web).toString());
    await web.getByRole("main").getByRole("link", { name: "Flat tire" }).first().click();
    await answerScreenOne(web, "flat-tire");
    await web.getByLabel("Street address or cross streets").fill("1200 Main St");
    await web.getByLabel("City").selectOption({ index: 1 });
    await web.getByRole("button", { name: "Continue" }).click();
    await web.getByLabel("Your name").fill("Ad Test Customer");
    await web
      .getByLabel("Mobile number")
      .fill(`(210) 555-01${String(Math.floor(Math.random() * 90) + 10)}`);
    await web.getByLabel("Make").fill("Toyota");
    await expect(web.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await web.getByRole("button", { name: "Send my request" }).click();
    await expect(web).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/);
    await driver.close();

    // Marketing downloads today's offline conversion file: the gclid is there.
    await signInAsDemo(page, appUrls.admin!, "Owner");
    const day = new Date().toISOString().slice(0, 10);
    await expect(async () => {
      const res = await page.request.get(
        new URL(`/api/marketing/offline-conversions?day=${day}`, appUrls.admin).toString(),
      );
      expect(res.status()).toBe(200);
      const csv = await res.text();
      expect(csv.split("\n")[0]).toBe(
        "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
      );
      expect(csv).toContain(`${gclid},request_submitted,`);
    }).toPass({ timeout: 30_000 });
    await page.goto(new URL("/marketing", appUrls.admin).toString());
    await expect(page.getByRole("heading", { name: "Marketing", level: 1 })).toBeVisible();
  });
});
