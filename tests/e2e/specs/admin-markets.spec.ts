import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-077: markets from the database, with boundary, settings, phone numbers and checklist.
const base = appUrls.admin;

test.describe("admin markets", () => {
  test.skip(!base, "No admin URL");

  test("market list and detail", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Super admin");
    await page.goto(new URL("/markets", base).toString());
    await expect(page.getByRole("heading", { name: "Markets", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole("main").getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Launch checklist" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Boundary" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("admin-market.png"), fullPage: true });
  });
});
