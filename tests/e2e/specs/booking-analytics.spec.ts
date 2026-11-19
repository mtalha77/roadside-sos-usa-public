import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-111: booking speed on Today, and the booking funnel, Compare quotes vs Instant book, the
// calls funnel and where people drop in Analytics. Real data by default; demo rows only when asked.
const base = appUrls.admin;

test.describe("booking speed and funnel analytics", () => {
  test.skip(!base, "No admin URL");

  test("Today shows both north-star timings; Analytics shows the funnels", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Owner");

    await page.goto(new URL("/", base).toString());
    const speed = page.getByRole("region", { name: "Booking speed" });
    await expect(speed.getByText("Landing to request submitted").first()).toBeVisible();
    await expect(speed.getByText("Request submitted to provider booked").first()).toBeVisible();
    await expect(speed.getByText("Includes demo")).toHaveCount(0);
    await speed.getByRole("link", { name: "Include demo data" }).click();
    await expect(page).toHaveURL(/demo=1/);
    await expect(
      page.getByRole("region", { name: /Booking speed/ }).getByText("Includes demo"),
    ).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);

    await page.goto(new URL("/analytics?view=demo&days=7", base).toString());
    for (const name of [
      /^Booking funnel/,
      /^Compare quotes vs Instant book/,
      /^Funnel by/,
      /^Where people drop/,
    ])
      await expect(page.getByRole("region", { name })).toBeVisible();
    await page.getByRole("link", { name: "Device", exact: true }).click();
    await expect(page).toHaveURL(/by=device/);
    await expect(page.getByRole("rowheader", { name: "Phone" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });
});
