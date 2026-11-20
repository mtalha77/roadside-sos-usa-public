import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-100: emergency-first home. On a 375 x 667 phone the tiles, "Get help now" and the 911 line
// are above the fold; a tile starts the request with that service and lands on the location step;
// the phone action bar appears only once the hero scrolls away.

const web = appUrls.web;
const url = (path: string) => new URL(path, web).toString();

test.describe("emergency-first home", () => {
  test.skip(!web, "No website URL");
  test.use({ viewport: { width: 375, height: 667 } });

  test("everything needed is above the fold, and one tap starts a request", async ({ page }) => {
    await page.goto(url("/"));
    const fold = 667;
    const below = async (name: string | RegExp, role: "link" | "heading" = "link") => {
      const box = await page.getByRole(role, { name }).first().boundingBox();
      expect(box, String(name)).not.toBeNull();
      expect(box!.y + box!.height, String(name)).toBeLessThanOrEqual(fold);
    };
    await below("Stuck on the road? Help is on the way.", "heading");
    await below("Tow");
    await below("Get help now");
    const safety = await page
      .getByText("In danger or on a busy highway? Call 911 first.")
      .boundingBox();
    expect(safety!.y + safety!.height).toBeLessThanOrEqual(fold);
    // Tiles are at least 96px tall.
    const tile = await page.getByRole("link", { name: "Tow" }).first().boundingBox();
    expect(tile!.height).toBeGreaterThanOrEqual(96);
    await expectNoA11yViolations(page);

    // The bottom bar is hidden while the hero is on screen, and shows after scrolling past it.
    const bar = page.locator("[data-mobile-bar]");
    await expect(bar).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 1600));
    await expect(bar).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar).toBeHidden();

    const started = Date.now();
    await page.getByRole("link", { name: "Tow" }).first().click();
    // RSOS-116: a tile opens that service's screen 1 (its quick questions).
    await expect(page).toHaveURL(/\/get-help\/tow\/problem/);
    await expect(page.getByRole("heading", { name: "What happened?", level: 1 })).toBeVisible();
    test.info().annotations.push({
      type: "tow-to-first-step-ms",
      description: String(Date.now() - started),
    });
    expect(new URL(page.url()).pathname).toBe("/get-help/tow/problem");
  });

  test("the theme toggle switches and remembers dark mode", async ({ page }) => {
    await page.goto(url("/"));
    const html = page.locator("html");
    const before = (await html.getAttribute("class"))?.includes("dark") ?? false;
    await page.getByRole("button", { name: "Switch between light and dark mode" }).first().click();
    await expect(html).toHaveClass(before ? /^(?!.*\bdark\b)/ : /\bdark\b/);
    await page.reload();
    await expect(html).toHaveClass(before ? /^(?!.*\bdark\b)/ : /\bdark\b/);
  });
});
