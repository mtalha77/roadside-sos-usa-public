import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-078: real prices and fees per market, scheduled change with approval.
const base = appUrls.admin;

test.describe("admin pricing", () => {
  test.skip(!base, "No admin URL");

  test("current prices and a scheduled change approved", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Owner");
    await page.goto(new URL("/pricing", base).toString());
    await expect(page.getByRole("heading", { name: "Pricing and fees", level: 1 })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Our fee" }).first()).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-pricing.png"), fullPage: true });
    const change = page.locator("details", { hasText: "Schedule a change" }).first();
    await change.locator("summary").click();
    await change.getByLabel("Lowest price").fill("75");
    await change.getByLabel("Highest price").fill("150");
    await change.getByLabel("Our fee").fill("15");
    await change.getByLabel("Effective from").fill("2027-01-01");
    await change.getByRole("button", { name: "Submit for approval" }).click();
    await change.getByRole("button", { name: "Approve" }).click();
    await expect(change.getByText("Approved (applies on the date)")).toBeVisible();
  });
});
