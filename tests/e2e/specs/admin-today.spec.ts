import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-103: Today replaces the overview (what needs a person now, the most urgent items with one
// action each, today's numbers per market, alerts); Calls is the call log, and phone intake opens
// from it ("Log a call").
const base = appUrls.admin;
const url = (p: string) => new URL(p, base).toString();

test.describe("admin Today and Calls", () => {
  test.skip(!base, "No admin URL");

  test("Today shows the strip, the urgent list, numbers and alerts", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Dispatcher");
    await page.goto(url("/"));
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
    await expect(page.getByText("Needs action now")).toBeVisible();
    await expect(page.getByText("Unanswered calls")).toBeVisible();
    await expect(page.getByText("No quote after 3 minutes")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Most urgent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today by market" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible();
    // Dispatchers do not see money.
    await expect(page.getByRole("columnheader", { name: "Fees earned" })).toHaveCount(0);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-today.png"), fullPage: true });
  });

  test("Calls lists calls, filters by outcome and opens phone intake", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Dispatcher");
    await page.goto(url("/calls"));
    await expect(page.getByRole("heading", { name: "Calls", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Missed", exact: true }).click();
    await expect(page).toHaveURL(/outcome=missed/);
    await expect(page.getByRole("link", { name: "Missed", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expectNoA11yViolations(page);
    await page.getByRole("link", { name: "Log a call" }).click();
    await expect(page.getByRole("heading", { name: "Phone intake", level: 1 })).toBeVisible();
  });
});
