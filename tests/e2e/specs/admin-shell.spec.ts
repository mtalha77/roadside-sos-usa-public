import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-071 + 103: admin shell with the grouped menu (a Menu button on phones), market switcher,
// command palette, shortcuts and demo controls.
const base = appUrls.admin;

test.describe("admin shell", () => {
  test.skip(!base, "No admin URL");

  test("palette, cheat sheet, market switcher and demo controls", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Owner");
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

    // The menu is grouped: Operate, Network, Business, System (behind "Menu" on phones).
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    const phone = await menu.isVisible();
    if (phone) await menu.click();
    for (const group of ["Operate", "Network", "Business", "System"])
      await expect(page.getByRole("button", { name: group, exact: true }).first()).toBeVisible();
    const operate = page.getByRole("button", { name: "Operate", exact: true }).first();
    await operate.click();
    await expect(operate).toHaveAttribute("aria-expanded", "false");
    await operate.click();
    await expect(page.getByRole("link", { name: "Calls" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Phone intake" })).toHaveCount(0);

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
