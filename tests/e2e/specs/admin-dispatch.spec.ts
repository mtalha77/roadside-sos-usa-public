import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-034 + 072, rebuilt in RSOS-103: one market at a time, Real / Demo / Both (Real by default),
// lanes plus "Needs closing", a side panel per request, J/K/Enter keys, and the load test (now in
// Demo controls).
const base = appUrls.admin;

test.describe("admin dispatch board", () => {
  test.skip(!base, "No admin URL");

  test("market, source filter, lanes, side panel, keys and 200-request load", async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Dispatcher");
    await page.goto(new URL("/dispatch", base).toString());
    await expect(page.getByRole("heading", { name: "Dispatch board", level: 1 })).toBeVisible();
    for (const lane of ["New", "Quoting", "Picked", "On the way", "On site", "Needs closing"])
      await expect(
        page.getByRole("heading", { name: new RegExp(`^${lane}`), level: 2 }),
      ).toBeVisible();
    // Real is the default: no demo card shows until Demo is chosen.
    await expect(page.getByRole("button", { name: "Real", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-card]").getByText("Demo", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Demo", exact: true }).click();
    await expect(page).toHaveURL(/source=demo/);
    await expect(page.locator("[data-card]").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Market")).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-dispatch.png"), fullPage: true });

    // Keyboard: J focuses the first card, Enter opens its side panel.
    await page.locator("main h1").click();
    await page.keyboard.press("j");
    await expect(page.locator("[data-card]").first()).toBeFocused();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Customer", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Push to more providers" }).click();
    await expect(panel.getByText("Sent to more providers (simulated).")).toBeVisible();
    await expectNoA11yViolations(page);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    // Load test (Demo controls): about 200 live demo requests, and the board keeps updating.
    const openDemo = async () => {
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      if (await menu.isVisible()) await menu.click();
      await page.getByRole("button", { name: "Demo controls" }).click();
    };
    await openDemo();
    await page.getByLabel("Load test: 200 demo requests on the dispatch board").check();
    await page.keyboard.press("Escape");
    if (await page.getByRole("dialog").isVisible()) await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Both", exact: true }).click();
    await page.reload();
    const status = page.getByText(/open requests ·/);
    await expect(status).toHaveText(/(\d{2,3}) open requests ·/, { timeout: 20_000 });
    const n = Number((await status.textContent())?.match(/(\d+) open/)?.[1] ?? 0);
    expect(n, "one market's share of the 200").toBeGreaterThanOrEqual(30);
    const longTasks = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let total = 0;
          try {
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) total += Math.max(0, e.duration - 50);
            }).observe({ type: "longtask", buffered: false });
          } catch {
            // WebKit has no long-task timing; the count above still proves the load.
          }
          setTimeout(() => resolve(total), 6000);
        }),
    );
    expect(longTasks, "blocking time over 6 s of live updates").toBeLessThan(600);
    await openDemo();
    await page.getByLabel("Load test on").uncheck();
  });
});
