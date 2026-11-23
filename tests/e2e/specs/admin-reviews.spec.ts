import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-080: moderation queue, low-rating follow-ups and quality scores with thresholds.
const base = appUrls.admin;

test.describe("admin reviews", () => {
  test.skip(!base, "No admin URL");

  test("moderate a review and see quality scores", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Owner");
    await page.goto(new URL("/reviews", base).toString());
    await expect(
      page.getByRole("heading", { name: "Reviews and quality", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Provider quality scores" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-reviews.png"), fullPage: true });
    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByText("Published.").first()).toBeVisible();
  });
});
