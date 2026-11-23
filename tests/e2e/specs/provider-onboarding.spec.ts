import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-052: onboarding wizard, resumable, finished well under 15 minutes with demo data.
const base = appUrls.provider;

test.describe("provider onboarding", () => {
  test.skip(!base, "No provider URL");

  test("all nine steps, resumable, then the in-review screen", async ({ page }, info) => {
    test.setTimeout(180_000);
    const started = Date.now();
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/onboarding", base).toString());
    await page.evaluate(() => localStorage.removeItem("rsos_onboarding"));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Join as a provider", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-onboarding.png"), fullPage: true });
    const next = page.getByRole("button", { name: "Save and continue" });
    await page.getByLabel("Your name").fill("Demo Owner");
    await page.getByLabel("Mobile number").fill("2105550123");
    await next.click();
    await expect(page.getByText("Step 2 of 9")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Step 2 of 9")).toBeVisible();
    for (let i = 2; i < 9; i++) await next.click();
    await page.getByLabel("I agree to the provider terms.").check();
    await page.getByLabel(/fee is charged only when/).check();
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Your company is in review.")).toBeVisible();
    await expectNoA11yViolations(page);
    expect(Date.now() - started).toBeLessThan(15 * 60_000);
  });
});
