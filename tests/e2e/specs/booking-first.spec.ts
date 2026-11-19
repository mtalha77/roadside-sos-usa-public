import type { Page } from "@playwright/test";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-108: on every public page at 375 px the first primary action books help online; calling is
// a small text link (never a button) and only where phones are enabled.
const web = appUrls.web;
const url = (p: string) => new URL(p, web).toString();

async function bookingFirst(page: Page) {
  const fold = page.viewportSize()!.height;
  const book = page
    .getByRole("main")
    .getByRole("link", { name: /^(Get help now|Book help now|Request a tow instead)$/ })
    .first();
  await expect(book).toBeVisible();
  const box = await book.boundingBox();
  expect(box!.y + box!.height, "the booking action is above the fold").toBeLessThanOrEqual(fold);
  // Any call link is plain text: no filled background, normal height.
  for (const call of await page.locator('a[href^="tel:"]').all()) {
    if (!(await call.isVisible())) continue;
    const style = await call.evaluate((e) => {
      const s = getComputedStyle(e);
      return { bg: s.backgroundColor, size: parseFloat(s.fontSize) };
    });
    expect(["rgba(0, 0, 0, 0)", "transparent"], "a call link is not a button").toContain(style.bg);
    expect(style.size, "a call link uses small text").toBeLessThanOrEqual(15);
  }
}

test.describe("booking first", () => {
  test.skip(!web, "No website URL");
  test.use({ viewport: { width: 375, height: 667 } });

  test("home, city, service, city service and landing pages lead with booking", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto(url("/"));
    await bookingFirst(page);
    await expect(page.getByText(/^Book help in under a minute/)).toBeVisible();
    const city = await page
      .locator('a[href^="/roadside-assistance/"]')
      .first()
      .getAttribute("href");
    await page.goto(url(city!));
    await bookingFirst(page);
    await page.goto(url("/services/flat-tire"));
    await bookingFirst(page);
    await page.goto(url(`${city!}/flat-tire`));
    await bookingFirst(page);
    await expectNoA11yViolations(page);
    const slug = city!.split("/").filter(Boolean).at(-1);
    await page.goto(url(`/lp/${slug}/flat-tire`));
    await expect(page.getByRole("link", { name: "Book help now" })).toBeVisible();
    await bookingFirst(page);
  });
});
