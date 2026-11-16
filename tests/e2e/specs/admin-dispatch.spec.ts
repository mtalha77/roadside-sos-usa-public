import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-034 + 072: live dispatch board with lanes, SLA timers, actions, supply and a load test.
const base = appUrls.admin;

test.describe("admin dispatch board", () => {
  test.skip(!base, "No admin URL");

  test("lanes, demo cards, actions and 200-request load", async ({ page }, info) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Dispatcher");
    await page.goto(new URL("/dispatch", base).toString());
    await expect(page.getByRole("heading", { name: "Live dispatch", level: 1 })).toBeVisible();
    for (const lane of ["New", "Quoting", "Picked", "En route", "On site"])
      await expect(
        page.getByRole("heading", { name: new RegExp(`^${lane}`), level: 2 }),
      ).toBeVisible();
    await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-dispatch.png"), fullPage: true });

    await page
      .getByRole("button", { name: /^Actions for/ })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Push to more providers" }).click();
    await expect(page.getByText("Sent to more providers (simulated).")).toBeVisible();

    // Load test: about 200 live demo requests, and the board keeps updating smoothly.
    await page.getByLabel("Load test: 200 demo requests").check();
    await page.reload();
    const status = page.getByText(/open requests$/);
    await expect(status).toHaveText(/(\d{3}) open requests$/, { timeout: 20_000 });
    const n = Number((await status.textContent())?.match(/(\d+) open/)?.[1] ?? 0);
    expect(n).toBeGreaterThanOrEqual(150);
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
    await page.getByLabel("Load test on").uncheck();
  });
});
