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

/** The demo job's code, read from the demo hint on the page. */
async function demoCode(page: import("@playwright/test").Page): Promise<string> {
  const hint = await page.getByText(/Demo: the customer's code is \d{4}/).innerText();
  return hint.match(/\d{4}/)![0];
}

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
    // RSOS-117: On my way, Arrived (GPS, mocked in the demo), Done with the customer's code.
    await page.getByRole("button", { name: "On my way" }).click();
    await expect(page.getByRole("button", { name: "Arrived" })).toBeDisabled();
    await page.getByRole("button", { name: "Demo: I'm at the customer" }).click();
    const codeBox = page.getByLabel("Customer's 4-digit code");
    await expect(codeBox).toBeVisible();
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("provider-job-code.png"), fullPage: true });
    await codeBox.fill("0000" === (await demoCode(page)) ? "1111" : "0000");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByText("That code isn't right.")).toBeVisible();
    await codeBox.fill(await demoCode(page));
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByText("Job completed. The customer can now rate you.")).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-active-job.png"), fullPage: true });
  });
});
