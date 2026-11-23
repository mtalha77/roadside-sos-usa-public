import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-074: phone intake console; a phone request is created in under 90 seconds (timed).
const base = appUrls.admin;

test.describe("admin phone intake", () => {
  test.skip(!base, "No admin URL");

  test("demo call to created request in under 90 seconds", async ({ page }, info) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Dispatcher");
    await page.goto(new URL("/intake", base).toString());
    await expect(page.getByRole("heading", { name: "Phone intake", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    const started = Date.now();
    await page.getByRole("button", { name: "Simulate an incoming call (demo)" }).click();
    await page.getByRole("button", { name: "Answer" }).click();
    await expect(page.getByRole("heading", { name: "Caller" })).toBeVisible();
    await page.getByLabel("Customer's name").fill("Test Caller");
    await page.getByLabel("Callback number").fill("2105550123");
    await page.getByLabel("Location").fill("I-35 at exit 160");
    await page.getByRole("button", { name: "Text a location link" }).click();
    await page.getByRole("button", { name: "Create request" }).click();
    await expect(page.getByText(/^Request P-\w+ created\.$/)).toBeVisible();
    expect(Date.now() - started).toBeLessThan(90_000);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("admin-intake.png"), fullPage: true });
  });
});
