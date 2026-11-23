import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-093: the account and security page from batch 2 inside the portal shell, at the quality bar.
const base = appUrls.provider;

test.describe("provider account and security in the shell", () => {
  test.skip(!base, "No provider URL");

  test("fits the shell, no a11y issues, light and dark", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/account", base).toString());
    await expect(
      page.getByRole("heading", { name: "Account and security", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Portal" }).first()).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-account-light.png"), fullPage: true });
    await page.emulateMedia({ colorScheme: "dark" });
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("provider-account-dark.png"), fullPage: true });
  });
});
