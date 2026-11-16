import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-075: providers table, map, document review queue and provider detail with actions.
const base = appUrls.admin;
const url = (p: string) => new URL(p, base).toString();

test.describe("admin providers", () => {
  test.skip(!base, "No admin URL");

  test("table, map, review queue and detail", async ({ page }, info) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Super admin");
    await page.goto(url("/providers"));
    await expect(page.getByRole("heading", { name: "Providers", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-providers.png"), fullPage: true });
    await page.getByRole("link", { name: "Map" }).click();
    await expect(page.getByRole("img", { name: "Map" })).toBeVisible();
    await page.getByRole("link", { name: /^Review queue/ }).click();
    await expectNoA11yViolations(page);
    await page.goto(url("/providers"));
    await page.getByRole("rowheader").getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("log", { name: "Actions" })).toContainText("Pause");
    await expectNoA11yViolations(page);
  });
});
