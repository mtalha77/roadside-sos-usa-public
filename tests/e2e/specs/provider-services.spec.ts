import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-058: prices within the market range, service area radius, hours and daily budget.
const base = appUrls.provider;

test.describe("provider services and prices", () => {
  test.skip(!base, "No provider URL");

  test("prices outside the market range are blocked", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/services", base).toString());
    await expect(
      page.getByRole("heading", { name: "Services and prices", level: 1 }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-services.png"), fullPage: true });
    const price = page.getByRole("textbox", { name: /your price/ }).first();
    await price.fill("1");
    await price.blur();
    await expect(page.getByText("Outside the market range").first()).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Fix the prices marked in red before saving.")).toBeVisible();
  });
});
