import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-055: the active job flow, opened from an active job's detail page.
const base = appUrls.provider;
const url = (p: string) => new URL(p, base).toString();

test.describe("provider active job", () => {
  test.skip(!base, "No provider URL");

  test("active job flow moves step by step", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(url("/jobs?tab=active"));
    const open = page.getByRole("main").getByRole("listitem").getByRole("link").first();
    test.skip((await open.count()) === 0, "No active demo job right now");
    await open.click();
    await page.getByRole("link", { name: "Open the job flow" }).click();
    await expect(page.getByRole("heading", { name: "Job in progress", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Waze" })).toBeVisible();
    await page.getByRole("button", { name: "Start driving" }).click();
    await expect(page.getByRole("button", { name: "I've arrived" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-active-job.png"), fullPage: true });
  });
});
