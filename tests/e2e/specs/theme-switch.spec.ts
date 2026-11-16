import type { Page } from "@playwright/test";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// Day and night switch: in the website header, on ad landing pages and in the provider portal.
// The choice is applied at once (the `dark` class on <html>) and survives a reload.

const html = (page: Page) => page.locator("html");

test.describe("day and night switch", () => {
  test("website header and landing page switch and remember the theme", async ({ page }) => {
    test.skip(!appUrls.web, "No website URL");
    for (const path of ["/", "/lp/houston/tow"]) {
      await page.goto(new URL(path, appUrls.web).toString());
      const toggle = page.getByRole("button", { name: "Switch between light and dark mode" });
      await expect(toggle).toHaveCount(1);
      const wasDark = ((await html(page).getAttribute("class")) ?? "").includes("dark");
      await toggle.click();
      if (wasDark) await expect(html(page)).not.toHaveClass(/\bdark\b/);
      else await expect(html(page)).toHaveClass(/\bdark\b/);
      await page.reload();
      if (wasDark) await expect(html(page)).not.toHaveClass(/\bdark\b/);
      else await expect(html(page)).toHaveClass(/\bdark\b/);
      await expectNoA11yViolations(page);
    }
  });

  test("provider portal switch overrides automatic night mode", async ({ page }) => {
    test.skip(!appUrls.provider, "No provider URL");
    test.setTimeout(90_000);
    await signInAsDemo(page, appUrls.provider!, "Provider owner");
    await page.goto(new URL("/more", appUrls.provider).toString());
    const toggle = page.getByRole("main").getByRole("button", { name: "Day or night mode" });
    const wasDark = ((await html(page).getAttribute("class")) ?? "").includes("dark");
    await toggle.click();
    if (wasDark) await expect(html(page)).not.toHaveClass(/\bdark\b/);
    else await expect(html(page)).toHaveClass(/\bdark\b/);
    await page.reload();
    if (wasDark) await expect(html(page)).not.toHaveClass(/\bdark\b/);
    else await expect(html(page)).toHaveClass(/\bdark\b/);
    await expectNoA11yViolations(page);
  });
});
