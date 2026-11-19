import { demoStream } from "@rsos/core/demo";
import type { Page } from "@playwright/test";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-022 and 065 to 069, with the owner's demo feedback: the driver drives a demo request on
// /r/[token] with a stage stepper, Back/Next, 1x/5x, skips, rich quote cards, profiles and compare.
const web = appUrls.web;
const url = (p: string) => new URL(p, web).toString();

/** Any demo request in the shared stream: the driver's own demo starts at the beginning. */
function demoToken(i = 0): string {
  const all = demoStream(Date.now(), { markets: ["houston", "san-antonio", "las-vegas"] });
  return all[i % all.length]!.token;
}

const H = {
  searching: /Finding providers/,
  quoting: /Quotes are coming in/,
  picked: /Provider confirmed/,
  en_route: /On the way/,
  on_site: /Provider arrived/,
  completed: /Job completed/,
};
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const demoBar = (page: Page) => page.getByRole("region", { name: "Demo controls" });
const next = (page: Page) => demoBar(page).getByRole("button", { name: "Next" }).click();

async function open(page: Page, i = 0) {
  await page.goto(url(`/r/${demoToken(i)}`));
  await expect(heading(page)).toHaveText(H.searching);
}

test.describe("request status page (driver demo)", () => {
  test.skip(!web, "No website URL");

  test("Next walks every stage, each one passes axe and fits the screen", async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    await open(page, 0);
    const stepper = page.getByRole("navigation", { name: "Request progress" });
    await expect(stepper.getByRole("listitem")).toHaveCount(6);
    for (const [stage, re] of Object.entries(H)) {
      await expect(heading(page)).toHaveText(re);
      await expect(stepper.locator('[aria-current="step"]')).toHaveCount(1);
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page);
      await page.screenshot({ path: info.outputPath(`${stage}.png`), fullPage: true });
      if (stage !== "completed") await next(page);
    }
    await expect(demoBar(page).getByRole("button", { name: "Next" })).toBeDisabled();
  });

  test("Back, the stepper and Skip to next stage move between stages", async ({ page }) => {
    await open(page, 1);
    await page.getByRole("button", { name: "Skip to next stage" }).click();
    await expect(heading(page)).toHaveText(H.quoting);
    await demoBar(page).getByRole("button", { name: "Back" }).click();
    await expect(heading(page)).toHaveText(H.searching);
    await next(page);
    await next(page); // picks the fastest quote
    await expect(heading(page)).toHaveText(H.picked);
    await next(page);
    await expect(heading(page)).toHaveText(H.en_route);
    // Tap a past stage on the stepper: back to the quotes, with the choice undone.
    await page.getByRole("button", { name: "Go back to Quotes" }).click();
    await expect(heading(page)).toHaveText(H.quoting);
    await expect(page.getByRole("button", { name: /View profile/ }).first()).toBeVisible();
    // A reload keeps the demo where it is.
    await page.reload();
    await expect(heading(page)).toHaveText(H.quoting);
  });

  test("On the way lasts about 20 s at 1x, with the ETA counting down", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page, 2);
    await next(page);
    await next(page);
    await next(page);
    await expect(heading(page)).toHaveText(H.en_route);
    const eta = page.getByText(/^\d+ min$/).last();
    const first = Number((await eta.textContent())?.replace(/\D/g, ""));
    const started = Date.now();
    await page.waitForTimeout(8_000);
    const later = Number((await eta.textContent())?.replace(/\D/g, ""));
    expect(later).toBeLessThan(first);
    await expect(heading(page)).toHaveText(H.on_site, { timeout: 30_000 });
    const sec = (Date.now() - started) / 1000;
    expect(sec).toBeGreaterThan(8);
    expect(sec).toBeLessThan(26);
  });

  test("5x speed and Skip to arrival", async ({ page }) => {
    await open(page, 3);
    await demoBar(page).getByRole("radio", { name: "5x" }).click();
    await expect(demoBar(page).getByRole("radio", { name: "5x" })).toBeChecked();
    // At 5x the first quote (20 to 45 s) shows up within about 9 s.
    await expect(heading(page)).toHaveText(H.quoting, { timeout: 12_000 });
    await demoBar(page).getByRole("button", { name: "Skip to arrival" }).click();
    await expect(heading(page)).toHaveText(H.on_site);
    // On site is 20 s at 1x: about 4 s at 5x.
    await expect(heading(page)).toHaveText(H.completed, { timeout: 10_000 });
  });

  test("quote cards open the full profile, compare up to three, and Back to quotes", async ({
    page,
  }) => {
    await open(page, 4);
    await demoBar(page).getByRole("radio", { name: "5x" }).click();
    await expect(page.getByRole("heading", { level: 2, name: /^[2-9] quotes$/ })).toBeVisible({
      timeout: 30_000,
    });
    await demoBar(page).getByRole("radio", { name: "1x" }).click();

    const cards = page.getByRole("button", { name: /View profile/ });
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
    // Unique fictional names, each a demo provider.
    const labels = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    const providers = labels.map((l) => l!.split(",")[0]!);
    expect(new Set(providers).size).toBe(providers.length);
    for (const p of providers) expect(p).toMatch(/\(demo\)$/);
    for (const box of await cards.all()) {
      const b = await box.boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(48);
    }
    await expect(page.getByText("Fastest", { exact: true }).first()).toBeVisible();

    // Profile: full sheet on phones, side panel on desktop.
    await cards.first().click();
    const profile = page.getByRole("dialog");
    await expect(profile.getByRole("heading", { name: providers[0] })).toBeVisible();
    for (const section of [
      "Services and prices",
      "Reviews",
      "Recent jobs",
      "Service area",
      "Payment methods",
    ])
      await expect(profile.getByRole("heading", { name: section })).toBeVisible();
    await expect(profile.getByText("Typical response")).toBeVisible();
    await expectNoA11yViolations(page);
    await profile.getByRole("button", { name: /Choose this provider/ }).click();
    await expect(
      page.getByText("You pay the provider directly when the job is done."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to quotes" }).click();
    await expect(heading(page)).toHaveText(H.quoting);

    // Compare two quotes side by side.
    const boxes = page.getByRole("checkbox", { name: "Compare" });
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await page.getByRole("button", { name: "Compare 2 quotes" }).click();
    const table = page.getByRole("dialog").getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveCount(2);
    await expectNoA11yViolations(page);
    await page.getByRole("dialog").getByRole("button", { name: "Choose" }).first().click();
    await page.getByRole("button", { name: "Confirm and request" }).click();
    await expect(heading(page)).toHaveText(/Provider confirmed|On the way/);
  });

  test("a full demo from request to review takes under 3 minutes at 1x", async ({ page }) => {
    test.setTimeout(200_000);
    const started = Date.now();
    await open(page, 5);
    await expect(heading(page)).toHaveText(H.quoting, { timeout: 60_000 });
    await page.getByRole("button", { name: "Choose", exact: true }).first().click();
    await page.getByRole("button", { name: "Confirm and request" }).click();
    await expect(heading(page)).toHaveText(H.en_route, { timeout: 20_000 });
    // Each step takes 20 s on the demo clock; WebKit on a busy CI runner can lag a few seconds.
    await expect(heading(page)).toHaveText(H.on_site, { timeout: 45_000 });
    await expect(heading(page)).toHaveText(H.completed, { timeout: 45_000 });
    await page.getByRole("radio", { name: "5 stars" }).click();
    await page.getByRole("button", { name: "Send review" }).click();
    await expect(page.getByText("Thanks for your review.")).toBeVisible();
    expect(Date.now() - started).toBeLessThan(180_000);
  });

  test("cancel with a reason, and an unknown token gets a friendly page", async ({ page }) => {
    await open(page, 6);
    await page.getByRole("button", { name: "Cancel request" }).click();
    await page.getByRole("radio", { name: "The problem is fixed" }).check();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel request" }).click();
    await expect(heading(page)).toHaveText(/Request cancelled/);
    await page.goto(url("/r/not-a-real-token-at-all"));
    await expect(heading(page)).toHaveText(/couldn't find that request/);
  });
});
