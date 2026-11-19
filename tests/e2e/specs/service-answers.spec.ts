import { signInAsDemo } from "../support/demo";
import { appUrls, expect, readOnly, test } from "../support/fixtures";
import { answerScreenOne, tap } from "../support/get-help";

// RSOS-116: a tow request's answers reach the admin request panel as short tags and in full.
const web = appUrls.web;
const admin = appUrls.admin;

test("tow answers appear in the admin request panel", async ({ page, browser }) => {
  test.skip(!web || !admin || readOnly, "Needs the website and admin; writes to the database");
  test.setTimeout(150_000);
  const name = `E2E Tow ${Date.now()}`;
  const site = await browser.newPage();
  await site.goto(new URL("/get-help/tow/problem", web).toString());
  await tap(site, /All-wheel or 4-wheel drive/, "Yes");
  await tap(site, /Does it roll and steer/, "No");
  await answerScreenOne(site, "tow");
  await site.getByLabel("Street address or cross streets").fill("1200 Main St");
  await site.getByLabel("City").selectOption({ index: 1 });
  await site.getByLabel("Destination address or shop name").fill("400 Oak St");
  await site.getByRole("button", { name: "Continue" }).click();
  await site.getByLabel("Your name").fill(name);
  await site
    .getByLabel("Mobile number")
    .fill(`(210) 555-01${String(Math.floor(Math.random() * 90) + 10)}`);
  await site.getByLabel("Make").fill("Ford");
  await expect(site.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 20_000,
  });
  await site.getByRole("button", { name: "Send my request" }).click();
  await expect(site).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/);
  await site.close();

  await signInAsDemo(page, admin!, "Dispatcher");
  await page.goto(new URL("/inbox", admin).toString());
  const item = page.getByRole("link", { name: new RegExp(name) }).first();
  await expect(item).toBeVisible({ timeout: 30_000 });
  await item.click();
  const panel = page.getByRole("article");
  await expect(panel.getByText("Flatbed needed")).toBeVisible();
  await expect(panel.getByText("Doesn't roll")).toBeVisible();
  await expect(panel.getByText("Does it roll and steer?")).toBeVisible();
});
