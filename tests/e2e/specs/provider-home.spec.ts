import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-053: home with the Go Online toggle, today's stats, wallet and blockers (demo company).
const base = appUrls.provider;

test.describe("provider home", () => {
  test.skip(!base, "No provider URL");

  test("go online, see today's stats and the wallet", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
    await expect(page.getByText("Quotes sent")).toBeVisible();
    await expect(page.getByText("Wallet balance").first()).toBeVisible();
    const toggle = page.getByRole("switch").first();
    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("aria-checked", before ?? "");
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-home.png"), fullPage: true });
  });
});
