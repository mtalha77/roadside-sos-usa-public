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
    // City page prices link to the city plus service pages (the tiles start the request flow).
    await page.getByRole("main").locator('a[href$="/tow"]').first().click();
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
    // The choice is saved by a server action (a POST); wait for it before leaving the page.
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.ok()),
      page.getByRole("button", { name: "Use this area" }).click(),
    ]);
    await expect(page.getByRole("combobox", { name: "Change area" })).toHaveValue(value!);
    // WebKit reports link prefetches cancelled by a navigation as errors: let them finish first.
    await page.waitForLoadState("networkidle");
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

// RSOS-020: home page.
test.describe("home page", () => {
  test.skip(!web, "No website URL");

  test("services are the main action and nothing is invented", async ({ page }) => {
    await page.goto(url("/"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What do you need?" })).toBeVisible();
    // The example quote is labelled as an example and shows no rating or review count.
    const example = page.getByRole("figure", { name: "Example of a quote" });
    await expect(example).toContainText("Example only");
    await expect(example).toContainText("New provider");
    await expect(page.getByText(/reviews?\b/i)).toHaveCount(0);
    await expect(page.getByText(/★|stars?\b/i)).toHaveCount(0);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test("FAQ has FAQPage structured data", async ({ page }) => {
    await page.goto(url("/"));
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faq = blocks
      .map((b) => JSON.parse(b) as { "@type": string; mainEntity?: unknown[] })
      .find((d) => d["@type"] === "FAQPage");
    expect(faq?.mainEntity?.length).toBeGreaterThanOrEqual(3);
  });
});

// RSOS-024: city pages.
test.describe("city pages", () => {
  test.skip(!web, "No website URL");

  test("each test market has its own copy, a canonical URL and valid structured data", async ({
    page,
  }) => {
    await page.goto(url("/"));
    const hrefs = await page
      .getByRole("contentinfo")
      .getByRole("navigation", { name: "Cities" })
      .getByRole("link")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    const intros = new Set<string>();
    for (const href of hrefs) {
      await page.goto(url(href));
      const h1 = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
      intros.add(h1 + (await page.locator("main p").first().textContent()));
      expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toContain(href);
      const types = (
        await page.locator('script[type="application/ld+json"]').allTextContents()
      ).map((b) => (JSON.parse(b) as { "@type": string })["@type"]);
      expect(types).toEqual(expect.arrayContaining(["Service", "BreadcrumbList", "FAQPage"]));
    }
    expect(intros.size).toBe(hrefs.length);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });
});

// RSOS-025: service pages and city plus service pages.
test.describe("service pages", () => {
  test.skip(!web, "No website URL");

  test("6 service pages and 18 city plus service pages, each starting the flow with market and service", async ({
    page,
    request,
  }) => {
    const services = ["flat-tire", "wont-start", "locked-out", "out-of-gas", "tow", "winch-out"];
    await page.goto(url("/"));
    const cities = await page
      .getByRole("contentinfo")
      .getByRole("navigation", { name: "Cities" })
      .getByRole("link")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(cities.length).toBeGreaterThanOrEqual(3);
    for (const s of services)
      expect((await request.get(url(`/services/${s}`))).status(), s).toBe(200);
    const notes = new Set<string>();
    for (const c of cities.slice(0, 3)) {
      for (const s of services) {
        await page.goto(url(`${c}/${s}`));
        notes.add((await page.locator("main h1 + p").textContent()) ?? "");
        const start = page.locator("main [data-flow-service]");
        const market = c.split("/").pop()!;
        await expect(start).toHaveAttribute("data-flow-market", market);
        // Winch out is not offered yet (seed data): the page says so and starts a tow instead.
        await expect(start).toHaveAttribute("data-flow-service", s === "winch-out" ? "tow" : s);
      }
    }
    expect(notes.size).toBe(18);
  });

  test("service and city plus service pages are accessible", async ({ page }) => {
    await page.goto(url("/services/tow"));
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page
      .getByRole("link", { name: /^Tow in / })
      .first()
      .click();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });
});
