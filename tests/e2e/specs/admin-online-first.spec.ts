import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-110: the admin leads with online bookings. Every request carries a source tag, manual
// dispatch is a fallback, phone items on the launch checklist are optional and the providers page
// shows the numbers that now drive the product.
const base = appUrls.admin;

test.describe("admin online first", () => {
  test.skip(!base, "No admin URL");

  test("source tags, Assign in More, optional phone items and provider stats", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Owner");

    await page.goto(new URL("/dispatch?source=demo", base).toString());
    const card = page.locator("[data-card]").first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText(/^(Website|Call)$/)).toBeVisible();
    await expectNoA11yViolations(page);

    await page.goto(new URL("/markets", base).toString());
    await page.getByRole("main").getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Launch checklist" })).toBeVisible();
    await expect(page.getByText(/Booking flow tested end to end/)).toBeVisible();
    await expect(page.getByText("(optional)").first()).toBeVisible();
    await expectNoA11yViolations(page);

    await page.goto(new URL("/providers", base).toString());
    for (const col of ["Online now", "Response rate", "Median quote time", "Booking rate"])
      await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
  });
});
