import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-081: funnel, sources, speed and economics with date ranges.
const base = appUrls.admin;

test.describe("admin analytics", () => {
  test.skip(!base, "No admin URL");

  test("funnel and economics across date ranges", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Super admin");
    await page.goto(new URL("/analytics", base).toString());
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Funnel" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-analytics.png"), fullPage: true });
    await page.getByRole("link", { name: "Last 30 days" }).click();
    await expect(page.getByRole("link", { name: "Last 30 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("heading", { name: "Economics" })).toBeVisible();
  });
});
