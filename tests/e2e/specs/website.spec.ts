import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-019: structure built from the database (the preview uses rsos-dev with the seeded markets).
const web = appUrls.web;
const url = (path: string) => new URL(path, web).toString();

test.describe("website structure", () => {
  test.skip(!web, "No website URL");

  test("menus list every published market and link to its city page", async ({ page }) => {
    await page.goto(url("/"));
    const footerCities = page.getByRole("contentinfo").getByRole("navigation", { name: "Cities" });
    const links = footerCities.getByRole("link");
    await expect(links.first()).toBeVisible();
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute("href");
      expect(href).toMatch(/^\/roadside-assistance\/[a-z]{2}\/[a-z0-9-]+$/);
      expect((await page.request.get(url(href!))).status()).toBe(200);
    }
  });

  test("a service tile opens get-help with that service selected", async ({ page }) => {
    await page.goto(url("/"));
    const tile = page.getByRole("main").getByRole("link", { name: /Flat tire/ });
    await tile.click();
    await expect(page).toHaveURL(/\/get-help\?service=flat-tire/);
    await expect(page.locator("[data-service='flat-tire']")).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("city pages carry their market into the flow; unknown cities are 404", async ({ page }) => {
    const res = await page.goto(url("/"));
    expect(res?.status()).toBe(200);
    const city = await page
      .getByRole("contentinfo")
      .getByRole("navigation", { name: "Cities" })
      .getByRole("link")
      .first()
      .getAttribute("href");
    await page.goto(url(city!));
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await page.getByRole("main").getByRole("link").filter({ hasText: /Tow/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`${city}/tow$`));
    await page.getByRole("main").getByRole("link", { name: "Get help now" }).click();
    await expect(page).toHaveURL(/\/get-help\?service=tow&market=[a-z-]+$/);
    await expect(page.locator("[data-market]")).toBeVisible();
    expect((await page.request.get(url("/roadside-assistance/tx/not-a-city"))).status()).toBe(404);
  });

  test("the visitor can change their area and it is remembered", async ({ page }) => {
    await page.goto(url("/"));
    const select = page.getByRole("combobox", { name: /area/i });
    const value = await select.locator("option:not([disabled])").first().getAttribute("value");
    await select.selectOption(value!);
    await page.getByRole("button", { name: "Use this area" }).click();
    await page.goto(url("/get-help"));
    await expect(page.locator(`[data-market='${value}']`)).toBeVisible();
  });

  test("structure pages and legal pages exist", async ({ request }) => {
    for (const p of [
      "/how-it-works",
      "/faq",
      "/about",
      "/contact",
      "/safety",
      "/for-providers",
      "/for-providers/apply",
      "/legal/privacy",
      "/legal/driver-terms",
      "/r/abc",
      "/providers/x",
    ]) {
      expect((await request.get(url(p))).status(), p).toBe(200);
    }
    expect((await request.get(url("/legal/not-a-doc"))).status()).toBe(404);
  });
});
