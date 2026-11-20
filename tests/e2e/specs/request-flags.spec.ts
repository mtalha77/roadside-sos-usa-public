import { demoStream } from "@rsos/core/demo";
import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  readOnly,
  test,
} from "../support/fixtures";
import { answerScreenOne, tap } from "../support/get-help";

// Owner decision 3 (2026-11-19): flagging from both sides, one tap plus a reason. The database
// side (priorities, who may flag and read, the admin Inbox) is covered by
// supabase/tests/038_request_flags.test.sql; here the customer and provider screens.

function demoToken(): string {
  return demoStream(Date.now(), { markets: ["houston", "san-antonio", "las-vegas"] })[0]!.token;
}

test.describe("request flags", () => {
  test("a customer reports a problem from the tracking page with one tap", async ({ page }) => {
    test.skip(!appUrls.web, "No website URL");
    await page.goto(new URL(`/r/${demoToken()}`, appUrls.web).toString());
    await page.getByRole("button", { name: "Report a problem" }).click();
    const sheet = page.getByRole("dialog", { name: "Report a problem" });
    await expect(sheet.getByRole("group", { name: /What went wrong/ })).toBeVisible();
    for (const reason of [
      "The provider didn't arrive",
      "The price changed",
      "Poor service",
      "I have a safety concern",
      "Something else",
    ])
      await expect(sheet.getByRole("button", { name: reason })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await sheet.getByLabel("Anything to add? (optional)").fill("Asked for more at the end");
    await sheet.getByRole("button", { name: "The price changed" }).click();
    await expect(page.getByText("Thanks. Our team will contact you.")).toBeVisible();
  });

  test("a provider flags an incoming request", async ({ page }) => {
    test.skip(!appUrls.provider, "No provider URL");
    test.setTimeout(90_000);
    await signInAsDemo(page, appUrls.provider!, "Provider owner");
    await page.goto(new URL("/offer", appUrls.provider).toString());
    await page.getByRole("button", { name: "Flag this request" }).first().click();
    const box = page.getByRole("region", { name: "Flag this request" });
    for (const reason of [
      "Fake or prank",
      "Wrong location",
      "Customer unreachable",
      "Unsafe",
      "Something else",
    ])
      await expect(box.getByRole("button", { name: reason })).toBeVisible();
    await expectNoA11yViolations(page);
    await box.getByRole("button", { name: "Wrong location" }).click();
    await expect(page.getByText("Flag sent. Our team will review it.")).toBeVisible();
  });

  test("a customer's safety report is urgent in the admin Inbox and gets resolved", async ({
    page,
    browser,
  }) => {
    test.skip(
      !appUrls.web || !appUrls.admin || readOnly,
      "Needs the website and admin; writes to the database",
    );
    test.setTimeout(180_000);
    const name = `E2E Flag ${Date.now()}`;
    const site = await browser.newPage();
    await site.goto(new URL("/get-help/tow/problem", appUrls.web).toString());
    await tap(site, /All-wheel or 4-wheel drive/, "No");
    await tap(site, /Does it roll and steer/, "Yes");
    await answerScreenOne(site, "tow");
    await site.getByLabel("Street address or cross streets").fill("1200 Main St");
    await site.getByLabel("City").selectOption({ index: 1 });
    await site.getByLabel("Destination address or shop name").fill("400 Oak St");
    await site.getByRole("button", { name: "Continue" }).click();
    await site.getByLabel("Your name").fill(name);
    // A fictional 555-01xx number in one of several area codes (the duplicate rule would reopen
    // another run's request for a number used within 30 minutes).
    const areas = ["210", "512", "713", "702", "602", "407", "305", "214", "615", "919"];
    await site
      .getByLabel("Mobile number")
      .fill(
        `(${areas[Math.floor(Math.random() * areas.length)]}) 555-01${String(Math.floor(Math.random() * 90) + 10)}`,
      );
    await site.getByLabel("Make").fill("Ford");
    await expect(site.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await site.getByRole("button", { name: "Send my request" }).click();
    await expect(site).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/, { timeout: 15_000 });

    // The customer reports a safety concern: one tap.
    await site.getByRole("button", { name: "Report a problem" }).click();
    await site
      .getByRole("dialog", { name: "Report a problem" })
      .getByRole("button", { name: "I have a safety concern" })
      .click();
    await expect(site.getByText("Thanks. Our team will contact you.")).toBeVisible();
    await site.close();

    // It is urgent and flagged in the Inbox; a dispatcher resolves it.
    await signInAsDemo(page, appUrls.admin!, "Dispatcher");
    await page.goto(new URL("/inbox", appUrls.admin).toString());
    const item = page.getByRole("link", { name: new RegExp(name) }).first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    await expect(item.getByText("Urgent")).toBeVisible();
    await expect(item.getByText("1 flag")).toBeVisible();
    await item.click();
    const flags = page.getByTestId("flag-list");
    await expect(flags.getByText("Safety concern")).toBeVisible();
    await expect(flags.getByText("From the customer")).toBeVisible();
    await expectNoA11yViolations(page);
    await flags.getByLabel("What did you do? (optional)").fill("Called the customer");
    await flags.getByRole("button", { name: "Resolve" }).click();
    await expect(flags.getByText("Resolved: Called the customer")).toBeVisible();
  });
});
