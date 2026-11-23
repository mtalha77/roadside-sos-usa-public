import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-061: performance numbers and return on fees by week.
const base = appUrls.provider;

test.describe("provider insights", () => {
  test.skip(!base, "No provider URL");

  test("rates, reply time and return on fees", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/insights", base).toString());
    await expect(page.getByRole("heading", { name: "Insights", level: 1 })).toBeVisible();
    await expect(page.getByText("Win rate")).toBeVisible();
    await expect(page.getByRole("img", { name: "Return on fees by week" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-insights.png"), fullPage: true });
  });
});
