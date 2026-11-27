import { demoStream } from "@rsos/core/demo";
import type { Page } from "@playwright/test";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-117: booking commitment on the driver's tracking page. With the booking fee off (the
// default everywhere) there is no fee text and no payment step; with it on (previewed on a demo
// request with ?fee=on) the pick shows the fee and the free cancel window. The tracking page shows
// the completion code, the backup button when the provider is late, and "Yes, fixed" or "No".
const web = appUrls.web;
const url = (p: string) => new URL(p, web).toString();
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const demoBar = (page: Page) => page.getByRole("region", { name: "Demo controls" });

function demoToken(i: number): string {
  const all = demoStream(Date.now(), { markets: ["houston", "san-antonio", "las-vegas"] });
  return all[i % all.length]!.token;
}

async function toQuotes(page: Page, i: number, query = "") {
  await page.goto(url(`/r/${demoToken(i)}${query}`));
  await expect(heading(page)).toHaveText(/Finding providers/);
  await demoBar(page).getByRole("button", { name: "Next" }).click();
  await expect(heading(page)).toHaveText(/Quotes are coming in/);
}

test.describe("booking commitment (driver)", () => {
  test.skip(!web, "No website URL");

  test("fee off: pick goes straight to tracking with the code, then Yes, fixed", async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await toQuotes(page, 11);
    await expect(page.getByText(/Booking fee/)).toHaveCount(0);
    await page.getByRole("button", { name: "Choose", exact: true }).first().click();
    await expect(page.getByText(/Booking fee|Free cancel/)).toHaveCount(0);
    await page.getByRole("button", { name: "Confirm and request" }).click();
    await expect(heading(page)).toHaveText(/Provider confirmed|On the way/);
    await expect(page.getByTestId("completion-code")).toHaveText(/^\d{4}$/);
    await expect(
      page.getByText("Give this code to the provider when the job is done."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "While you wait" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("tracking-code.png"), fullPage: true });
    // Skip to the end: Yes, fixed, then the rating.
    for (let i = 0; i < 3; i++) {
      const nextBtn = demoBar(page).getByRole("button", { name: "Next" });
      if (await nextBtn.isEnabled()) await nextBtn.click();
    }
    await expect(heading(page)).toHaveText(/Job completed/);
    await page.getByRole("button", { name: "Yes, fixed" }).click();
    await expect(page.getByRole("button", { name: "Yes, fixed" })).toHaveCount(0);
    await page.getByRole("radio", { name: "5 stars" }).click();
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page.getByText("Thanks for your review.")).toBeVisible();
  });

  test("fee on: the pick shows the fee and free cancel; a late provider can be replaced", async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await toQuotes(page, 12, "?fee=on");
    await expect(
      page.getByText("You pay the provider directly for the job.", { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Choose", exact: true }).first().click();
    await expect(page.getByText(/Free cancel for 2 minutes/)).toBeVisible();
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("pick-with-fee.png"), fullPage: true });
    await page.getByRole("button", { name: /Confirm booking, \$5\.00/ }).click();
    await expect(page.getByTestId("completion-code")).toBeVisible();
    // Cancelling inside the window says the fee comes back.
    await page.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.getByText(/booking fee comes back/)).toBeVisible();
    await page.getByRole("button", { name: "Keep my request" }).click();
    // The provider runs late: the backup button appears and sends the request out again.
    await page.getByRole("button", { name: "Demo: make the provider late" }).click();
    await page.getByRole("button", { name: "Find me another provider" }).click();
    await expect(page.getByText(/finding you another provider/)).toBeVisible();
    await expect(heading(page)).toHaveText(/Quotes are coming in/);
  });

  test("No opens a short dispute", async ({ page }) => {
    test.setTimeout(120_000);
    await toQuotes(page, 13);
    await page.getByRole("button", { name: "Choose", exact: true }).first().click();
    await page.getByRole("button", { name: "Confirm and request" }).click();
    for (let i = 0; i < 3; i++) {
      const nextBtn = demoBar(page).getByRole("button", { name: "Next" });
      if (await nextBtn.isEnabled()) await nextBtn.click();
    }
    await expect(heading(page)).toHaveText(/Job completed/);
    await page.getByRole("button", { name: "No", exact: true }).click();
    await page.getByLabel("What went wrong?").fill("The battery died again after 10 minutes.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/Our team will look into it/)).toBeVisible();
  });
});
