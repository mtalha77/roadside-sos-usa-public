import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-056: jobs history with tabs and job detail.
const base = appUrls.provider;
const url = (p: string) => new URL(p, base).toString();

test.describe("provider jobs", () => {
  test.skip(!base, "No provider URL");

  test("history tabs, job detail and fee dispute", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(url("/jobs?tab=won"));
    await expect(page.getByRole("heading", { name: "Jobs", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-jobs.png"), fullPage: true });
    await page.getByRole("main").getByRole("listitem").getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Dispute the fee" }).click();
    await expect(page.getByText(/Dispute sent/)).toBeVisible();
  });
});
