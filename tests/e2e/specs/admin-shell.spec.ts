import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-071: admin shell with sidebar, market switcher, command palette, shortcuts, demo controls.
const base = appUrls.admin;

test.describe("admin shell", () => {
  test.skip(!base, "No admin URL");

  test("palette, cheat sheet, market switcher and demo controls", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Super admin");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-overview.png"), fullPage: true });

    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.locator("body").click({ position: { x: 5, y: 400 } });
    await page.keyboard.press("Shift+?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Markets in view/ }).click();
    await expect(page.getByRole("group", { name: "Markets in view" })).toBeVisible();
    await page.keyboard.press("Escape");

    const demo = page.getByRole("button", { name: "Demo controls" });
    if (await demo.isVisible()) {
      await demo.click();
      await page.getByRole("button", { name: "Pause" }).click();
      await expect(page.getByText("Scenario paused")).toBeVisible();
      await page.getByRole("button", { name: "Reset to now" }).click();
      await expect(page.getByText("Scenario running in real time")).toBeVisible();
    }
  });
});
