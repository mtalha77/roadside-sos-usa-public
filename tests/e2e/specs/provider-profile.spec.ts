import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-059: public profile editor with live preview and strength meter.
const base = appUrls.provider;

test.describe("provider public profile", () => {
  test.skip(!base, "No provider URL");

  test("editing updates the preview and the strength meter", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/profile", base).toString());
    await expect(page.getByRole("heading", { name: "Public profile", level: 1 })).toBeVisible();
    await page.getByLabel("Hours shown to customers").fill("Open 24/7");
    await expect(page.getByLabel("Live preview").getByText("Open 24/7")).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-profile.png"), fullPage: true });
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText(/^Saved on this device/)).toBeVisible();
  });
});
