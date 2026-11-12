import { brand } from "@rsos/config/brand";
import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`home page shows the brand name (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(brand.name);
    // No horizontal scrolling at any viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
}
