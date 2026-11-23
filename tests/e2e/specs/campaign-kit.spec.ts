import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-089-prep: the real launch checklist on a market (going live needs it green or a logged
// super admin override; the database rule itself is covered by pgTAP), and the test campaign view.

test.describe("test campaign kit", () => {
  test.skip(!appUrls.admin, "No admin URL");

  test("launch checklist, status control and campaign analytics", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, appUrls.admin!, "Owner");
    await page.goto(new URL("/markets", appUrls.admin).toString());
    const first = page.locator('a[href^="/markets/"]').first();
    await first.click();
    await expect(page.getByRole("heading", { name: "Launch checklist" })).toBeVisible();
    await expect(page.getByText("Enough active providers per service")).toBeVisible();
    await expect(page.getByText("Phone schedule covers 24/7")).toBeVisible();
    // Choosing "Active" while items are missing asks a super admin for a logged reason.
    const status = page.getByLabel("Market status");
    if ((await status.inputValue()) !== "active") {
      await status.selectOption("active");
      await expect(page.getByLabel(/reason to go live anyway/)).toBeVisible();
    }
    await expectNoA11yViolations(page);

    await page.goto(new URL("/campaign", appUrls.admin).toString());
    await expect(page.getByRole("heading", { name: "Test campaign", level: 1 })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Fill rate" })).toBeVisible();
    const csv = await page.request.get(
      new URL("/api/campaign/export?days=14", appUrls.admin).toString(),
    );
    expect(csv.status()).toBe(200);
    expect((await csv.text()).split("\n")[0]).toContain("Market,Requests,Calls,Answer rate %");
    await expectNoA11yViolations(page);
  });
});
