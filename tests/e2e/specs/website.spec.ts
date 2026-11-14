import {
  readOnly,
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
    const tile = page
      .getByRole("main")
      .getByRole("link", { name: /Flat tire/ })
      .first();
    await tile.click();
    await expect(page).toHaveURL(/\/get-help\?service=flat-tire/);
    await expect(page.locator("input[name=service][value='flat-tire']")).toHaveCount(1);
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
    await expect(page.locator("select[name=market]")).not.toHaveValue("");
    expect((await page.request.get(url("/roadside-assistance/tx/not-a-city"))).status()).toBe(404);
  });

  test("the visitor can change their area and it is remembered", async ({ page }) => {
    await page.goto(url("/"));
    const select = page.getByRole("combobox", { name: /area/i });
    const value = await select.locator("option:not([disabled])").first().getAttribute("value");
    await select.selectOption(value!);
    // A plain form post that comes back to this page with the choice remembered.
    await page.getByRole("button", { name: "Use this area" }).click();
    await expect(page.getByRole("combobox", { name: "Change area" })).toHaveValue(value!);
    await page.goto(url("/get-help"));
    await expect(page.locator("select[name=market]")).toHaveValue(value!);
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

// RSOS-027: content pages and the contact form.
test.describe("content pages", () => {
  test.skip(!web, "No website URL");

  test("FAQ is grouped, searchable and has valid FAQPage data", async ({ page }) => {
    await page.goto(url("/faq"));
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faq = blocks
      .map(
        (b) =>
          JSON.parse(b) as {
            "@type": string;
            mainEntity?: { name: string; acceptedAnswer: { text: string } }[];
          },
      )
      .find((d) => d["@type"] === "FAQPage");
    expect(faq?.mainEntity?.length).toBeGreaterThanOrEqual(10);
    for (const q of faq!.mainEntity!) expect(q.name && q.acceptedAnswer.text).toBeTruthy();
    await page.getByRole("searchbox", { name: "Search questions" }).fill("membership");
    await expect(page.locator("main details:visible")).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Search questions" }).fill("zzzz");
    await expect(page.getByText('No questions match "zzzz".')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("how it works has driver and provider tabs; about and safety render", async ({ page }) => {
    await page.goto(url("/how-it-works"));
    await page.getByRole("tab", { name: "For providers" }).click();
    await expect(page.getByRole("heading", { name: "Send your quote" })).toBeVisible();
    await expectNoA11yViolations(page);
    for (const p of ["/about", "/safety"]) {
      await page.goto(url(p));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoA11yViolations(page);
      await expectNoHorizontalScroll(page);
    }
  });

  test("contact form stores a message (Turnstile test keys)", async ({ page }) => {
    test.skip(readOnly, "Writes to the database");
    await page.goto(url("/contact"));
    await page.getByRole("textbox", { name: /Your name/ }).fill("E2E Test");
    await page.getByRole("textbox", { name: /Email/ }).fill("e2e@example.test");
    await page
      .getByRole("textbox", { name: /Message/ })
      .fill("Automated test message from the e2e suite.");
    // The Turnstile test key passes on its own; wait until it has added its token.
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Thanks. We got your message")).toBeVisible();
  });
});

// RSOS-026: For providers and the application form.
test.describe("for providers", () => {
  test.skip(!web, "No website URL");

  test("fees come from the database and the application is stored", async ({ page }) => {
    test.skip(readOnly, "Writes to the database");
    await page.goto(url("/for-providers"));
    await expect(page.getByRole("heading", { name: "Fee per picked request" })).toBeVisible();
    await expect(page.locator("main table").first()).toContainText("$");
    await expectNoA11yViolations(page);
    await page.getByRole("link", { name: "Apply to join" }).first().click();
    await page.getByRole("textbox", { name: /Company name/ }).fill("E2E Test Towing");
    await page.getByRole("textbox", { name: /Your name/ }).fill("E2E Tester");
    await page.getByRole("textbox", { name: /Mobile phone/ }).fill("(713) 555-0188");
    await page.getByRole("textbox", { name: /Email/ }).fill("apply-e2e@example.test");
    await page
      .getByRole("group", { name: /Cities you serve/ })
      .getByRole("checkbox")
      .first()
      .check();
    await page
      .getByRole("group", { name: /Services you offer/ })
      .getByRole("checkbox")
      .first()
      .check();
    await page.getByRole("spinbutton", { name: /Number of trucks/ }).fill("2");
    await page.getByRole("textbox", { name: /Insurance carrier/ }).fill("E2E Mutual");
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Send application" }).click();
    await expect(page.getByText("We got your application")).toBeVisible();
  });
});

// RSOS-028: legal pages and consent.
test.describe("legal pages and consent", () => {
  test.skip(!web, "No website URL");

  test("every legal page is a versioned draft", async ({ page }) => {
    for (const doc of [
      "driver-terms",
      "provider-terms",
      "privacy",
      "sms-terms",
      "call-recording",
      "cookies",
      "accessibility",
    ]) {
      await page.goto(url(`/legal/${doc}`));
      await expect(page.getByText("Draft for attorney review")).toBeVisible();
      await expect(page.locator("article[data-policy-version]")).toHaveAttribute(
        "data-policy-version",
        /^\d{4}-\d{2}-\d{2}/,
      );
    }
    await expectNoA11yViolations(page);
  });

  test.describe("before any choice", () => {
    test.use({ presetConsent: false });

    // Google, Meta, Microsoft ad and analytics hosts, and Vercel Analytics.
    const TAGS =
      /googletagmanager|google-analytics|doubleclick|googleadservices|facebook\.net|connect\.facebook|bat\.bing|_vercel\/(insights|speed-insights)/;

    test("AC1: no analytics or ad tag fires before consent; Consent Mode starts denied", async ({
      page,
    }) => {
      const tagRequests: string[] = [];
      page.on("request", (r) => {
        if (TAGS.test(r.url())) tagRequests.push(r.url());
      });
      await page.goto(url("/"));
      await expect(page.getByRole("region", { name: "Your privacy choices" })).toBeVisible();
      const defaults = await page.evaluate(() =>
        (window as unknown as { dataLayer: unknown[][] }).dataLayer
          .map((a) => Array.from(a as ArrayLike<unknown>))
          .find((a) => a[0] === "consent" && a[1] === "default"),
      );
      expect(defaults?.[2]).toMatchObject({
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      await page.waitForLoadState("networkidle");
      expect(tagRequests).toEqual([]);
      await expectNoA11yViolations(page);
    });

    test("choices update Consent Mode; Global Privacy Control keeps ads off", async ({ page }) => {
      // A browser with Global Privacy Control on sends Sec-GPC and exposes navigator.globalPrivacyControl.
      await page.setExtraHTTPHeaders({ "Sec-GPC": "1" });
      await page.addInitScript(() =>
        Object.defineProperty(navigator, "globalPrivacyControl", { value: true }),
      );
      await page.goto(url("/"));
      // The form posts, then the page reloads with the choice applied by the head script.
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/api/consent")),
        page.getByRole("button", { name: "Accept all" }).click(),
      ]);
      await page.waitForLoadState("load");
      await page.waitForFunction(() =>
        Array.isArray((window as unknown as { dataLayer?: unknown[] }).dataLayer),
      );
      await expect(page.getByRole("region", { name: "Your privacy choices" })).toBeHidden();
      const update = await page.evaluate(() =>
        (window as unknown as { dataLayer: unknown[][] }).dataLayer
          .map((a) => Array.from(a as ArrayLike<unknown>))
          .filter((a) => a[0] === "consent" && a[1] === "update")
          .at(-1),
      );
      expect(update?.[2]).toMatchObject({
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_personalization: "denied",
      });
      // The footer link opens the choices page; advertising cannot be turned on with GPC.
      await page.getByRole("link", { name: "Your privacy choices" }).click();
      await expect(page.getByRole("switch", { name: /Advertising/ })).toBeDisabled();
      await expect(page.getByRole("switch", { name: /Analytics/ })).toBeChecked();
      await expectNoA11yViolations(page);
    });
  });
});

// RSOS-032: technical SEO, checked by crawling every page in the sitemaps.
test.describe("technical SEO", () => {
  test.skip(!web, "No website URL");

  test("AC1: no duplicate titles and no missing canonicals; AC2: only published pages", async ({
    request,
  }) => {
    test.setTimeout(120_000);
    const locs = (xml: string) =>
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    const index = await (await request.get(url("/sitemap.xml"))).text();
    const paths: string[] = [];
    for (const sm of locs(index)) {
      const res = await request.get(url(new URL(sm).pathname));
      expect(res.status(), sm).toBe(200);
      paths.push(...locs(await res.text()).map((l) => new URL(l).pathname));
    }
    expect(paths.length).toBeGreaterThanOrEqual(30);
    expect(
      paths.some((p) => /phoenix|orlando/.test(p)),
      "paused markets are not listed",
    ).toBe(false);
    expect(paths).not.toContain("/get-help");
    const titles = new Map<string, string>();
    for (const p of paths) {
      const html = await (await request.get(url(p))).text();
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
      expect(title, `title on ${p}`).toBeTruthy();
      expect(
        canonical && new URL(canonical).pathname.replace(/\/$/, "") === p.replace(/\/$/, ""),
        `canonical on ${p}: ${canonical}`,
      ).toBe(true);
      expect(titles.get(title!), `duplicate title "${title}"`).toBeUndefined();
      titles.set(title!, p);
    }
  });

  test("robots blocks crawling outside production; Organization and WebSite data on the home page", async ({
    page,
    request,
  }) => {
    expect(await (await request.get(url("/robots.txt"))).text()).toMatch(/Disallow: \/\s*$/m);
    await page.goto(url("/"));
    const graph = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .map((b) => JSON.parse(b) as { "@graph"?: { "@type": string }[] })
      .flatMap((d) => d["@graph"] ?? [])
      .map((n) => n["@type"]);
    expect(graph).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
    expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toMatch(
      /opengraph-image/,
    );
  });
});
