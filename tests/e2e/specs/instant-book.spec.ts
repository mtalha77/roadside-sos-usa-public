import type { Page } from "@playwright/test";
import { demoStream } from "@rsos/core/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-109: Instant book on the customer's status page (demo scenario): the first quote at or
// below the ceiling books itself, a higher quote never books, the customer can switch, and after
// the quote window it falls back to comparing the quotes (manual dispatch: unit tests).
const web = appUrls.web;
const url = (p: string) => new URL(p, web).toString();
const token = (i: number) =>
  demoStream(Date.now(), { markets: ["houston", "san-antonio", "las-vegas"] })[i]!.token;
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const next = (page: Page) =>
  page.getByRole("region", { name: "Demo controls" }).getByRole("button", { name: "Next" }).click();

async function instant(page: Page, dollars: string) {
  await page.getByRole("radio", { name: /Book the fastest provider automatically/ }).check();
  await page.getByLabel("Most you'll pay").fill(dollars);
  await page.getByRole("button", { name: "Use this price" }).click();
  await expect(page.getByText(/^Instant book is on/)).toBeVisible();
}

test.describe("Instant book", () => {
  test.skip(!web, "No website URL");

  test("the first quote at or below the ceiling is booked automatically", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(url(`/r/${token(1)}`));
    await expect(heading(page)).toHaveText(/Finding providers/);
    await expect(page.getByRole("radio", { name: "Compare quotes" })).toBeChecked();
    await instant(page, "5000");
    await expectNoA11yViolations(page);
    await next(page); // to the first quote
    await expect(heading(page)).toHaveText(/Provider confirmed|On the way/, { timeout: 15_000 });
    await expect(page.getByText(/^Booked automatically/)).toBeVisible();
  });

  test("a higher quote never books, and after the window the quotes are compared", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const t = token(2);
    await page.goto(url(`/r/${t}`));
    await instant(page, "5");
    await next(page);
    await expect(heading(page)).toHaveText(/Quotes are coming in/);
    // Past the 3-minute quote window: nothing was at or below 5 USD.
    await page.evaluate((k) => {
      localStorage.setItem(
        `rsos_demo_clock_${k}`,
        JSON.stringify({ base: 200, anchor: Date.now(), speed: 1 }),
      );
    }, t);
    await page.reload();
    await expect(heading(page)).toHaveText(/Quotes are coming in/);
    await expect(page.getByText(/^No provider accepted at \$5\.00 or less in time/)).toBeVisible();
    // The quotes that came in are listed to compare and choose from.
    await expect(page.getByRole("heading", { name: /^\d+ quotes?$/ })).toBeVisible();
  });

  test("switching back to Compare quotes before a booking stops the automatic booking", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(url(`/r/${token(3)}`));
    await instant(page, "5000");
    await page.getByRole("radio", { name: "Compare quotes" }).check();
    await next(page);
    await expect(heading(page)).toHaveText(/Quotes are coming in/);
    await expect(page.getByText(/^Booked automatically/)).toHaveCount(0);
  });
});
