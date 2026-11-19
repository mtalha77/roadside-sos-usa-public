import { answerScreenOne, tap } from "../support/get-help";
import {
  appUrls,
  readOnly,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-021, three screens since RSOS-101: what happened, where, who and which vehicle.
const web = appUrls.web;
const url = (p: string) => new URL(p, web).toString();
const fakePhone = () => `(210) 555-01${String(Math.floor(Math.random() * 90) + 10)}`;

test.describe("get help flow", () => {
  test.skip(!web, "No website URL");

  test("a first-time customer sends a request in three screens, under 60 seconds", async ({
    page,
  }, info) => {
    test.skip(readOnly, "Writes to the database");
    test.setTimeout(90_000);
    const started = Date.now();
    await page.goto(url("/get-help"));
    await expectNoA11yViolations(page);

    // Screen 1 of 3: the service, its quick questions, and optional details.
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await page.getByRole("link", { name: "Flat tire" }).click();
    await expect(page).toHaveURL(/\/get-help\/flat-tire\/problem$/);
    await answerScreenOne(page, "flat-tire", false);
    await page.screenshot({ path: info.outputPath("problem.png"), fullPage: true });
    await page.getByRole("button", { name: "Continue" }).click();

    // Screen 2 of 3: where.
    await expect(page).toHaveURL(/\/get-help\/flat-tire\/location$/);
    await page.getByLabel("Street address or cross streets").fill("1200 Main St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();

    // Screen 3 of 3: who and which vehicle, then send.
    await expect(page.getByText("Step 3 of 3")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Who should the provider look for?" }),
    ).toBeVisible();
    await page.getByLabel("Your name").fill("E2E Customer");
    await page.getByLabel("Mobile number").fill(fakePhone());
    await page.getByLabel("Make").fill("Toyota");
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/);
    expect(Date.now() - started).toBeLessThan(60_000);
  });

  test("errors say what to do next and keep what was typed", async ({ page }) => {
    await page.goto(url("/get-help/flat-tire/problem"));
    await answerScreenOne(page, "flat-tire");
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.getByLabel("Street address or cross streets").fill("somewhere");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Type a street address/ }),
    ).toBeVisible();
    // Still on the location screen, with what was typed kept.
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.getByLabel("Street address or cross streets")).toHaveValue("somewhere");
    await page.getByLabel("Street address or cross streets").fill("500 Commerce St");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Your name").fill("E2E Customer");
    // Empty required fields are caught by the browser; a short number reaches our own check.
    await page.getByLabel("Mobile number").fill("210555");
    await page.getByLabel("Make").fill("Toyota");
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page.getByText(/Enter a 10-digit US mobile number/)).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveValue("E2E Customer");
    await expectNoHorizontalScroll(page);
  });
});

// RSOS-116: the questions each service needs, required ones enforced and optional ones skippable.
test.describe("get help: questions per service", () => {
  test.skip(!web, "No website URL");

  for (const service of ["tow", "wont-start", "flat-tire", "locked-out", "out-of-gas", "winch-out"])
    test(`${service}: required questions are enforced, optional ones skippable`, async ({
      page,
    }) => {
      await page.goto(url(`/get-help/${service}/problem`));
      await expect(page.getByText("Step 1 of 3")).toBeVisible();
      // Nothing answered: the browser (or our own check) keeps the customer on screen 1.
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page).toHaveURL(new RegExp(`/get-help/${service}/problem`));
      // Only the required ones answered: the location screen opens.
      await answerScreenOne(page, service);
      await expect(page).toHaveURL(new RegExp(`/get-help/${service}/location`));
      await expectNoA11yViolations(page);
    });

  test("in a traffic lane, or a child or pet inside: a red Call 911 banner, then continue", async ({
    page,
  }) => {
    await page.goto(url("/get-help/locked-out/problem"));
    await expect(page.getByRole("alert").filter({ hasText: "Call 911 now" })).toHaveCount(0);
    await tap(page, /Are you in a safe place/, "In a traffic lane");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /Call 911 now/ })
        .first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Call 911" }).first()).toHaveAttribute(
      "href",
      "tel:911",
    );
    await tap(page, /Are you in a safe place/, "Safe spot (parking lot, driveway)");
    await tap(page, /Is a child or pet inside/, "Yes");
    await expect(page.getByRole("alert").filter({ hasText: /child or pet/ })).toBeVisible();
    await tap(page, /Where are the keys/, "Locked inside");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/get-help\/locked-out\/location/);
  });
});

// RSOS-116: Back, refresh and returning (owner report: Back showed a different page).
test.describe("get help: going back", () => {
  test.skip(!web, "No website URL");

  for (const start of ["/", "/services/flat-tire"])
    test(`tile from ${start}: Back from screen 1 returns to the same page and scroll`, async ({
      page,
    }) => {
      await page.goto(url(start));
      const link = page.getByRole("main").locator('a[href^="/get-help/flat-tire/problem"]').first();
      await link.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => scrollY);
      await link.click();
      await expect(page).toHaveURL(/\/get-help\/flat-tire\/problem/);
      await page.getByRole("link", { name: "Back" }).click();
      await page.waitForURL((u) => u.pathname === start);
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeGreaterThanOrEqual(Math.max(0, y - 40));
    });

  test("a city page tile returns to the city page", async ({ page }) => {
    await page.goto(url("/"));
    const city = await page
      .locator('a[href^="/roadside-assistance/"]')
      .first()
      .getAttribute("href");
    await page.goto(url(city!));
    await page.getByRole("main").locator('a[href^="/get-help/"]').first().click();
    await expect(page).toHaveURL(/\/get-help\/[a-z-]+\/problem/);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === city);
  });

  test("step 3, Back, Back keeps the answers; refresh on step 2 keeps them", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(url("/get-help/flat-tire/problem"));
    await answerScreenOne(page, "flat-tire");
    await page.getByLabel("Street address or cross streets").fill("700 Market St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/details$/);
    await page.getByLabel("Make").fill("Honda");
    // Back to step 2 (in-page link) and back to step 1 (browser back): the answers are kept.
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/location$/);
    await expect(page.getByLabel("Street address or cross streets")).toHaveValue("700 Market St");
    await page.reload();
    await expect(page.getByLabel("Street address or cross streets")).toHaveValue("700 Market St");
    await page.goBack();
    await expect(page).toHaveURL(/\/problem$/);
    await expect(
      page
        .getByRole("group", { name: /Do you have a spare/ })
        .getByRole("radio", { name: "Full-size" }),
    ).toBeChecked();
  });

  test("after submit, Back from the request page goes to the starting page", async ({ page }) => {
    test.skip(readOnly, "Writes to the database");
    test.setTimeout(90_000);
    await page.goto(url("/services/flat-tire"));
    await page.getByRole("main").locator('a[href^="/get-help/flat-tire/problem"]').first().click();
    await answerScreenOne(page, "flat-tire");
    await page.getByLabel("Street address or cross streets").fill("1200 Main St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Your name").fill("E2E Back");
    await page.getByLabel("Mobile number").fill(fakePhone());
    await page.getByLabel("Make").fill("Toyota");
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/services/flat-tire");
  });
});

// RSOS-029: ad landing pages.
test.describe("ad landing pages", () => {
  test.skip(!web, "No website URL");

  test("one job: no menu, headline from the allowed list, first step on screen, noindex", async ({
    page,
  }, info) => {
    await page.goto(url("/lp/houston/tow?h=price&utm_source=google&gclid=test123"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/see real prices/);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('input[name="gclid"]')).toHaveValue("test123");
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("lp.png"), fullPage: true });
    await page.goto(url("/lp/houston/tow?h=<script>"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Get quotes in minutes/);
    expect((await page.request.get(url("/lp/nowhere/tow"))).status()).toBe(404);
  });

  test("the first step continues into the request flow with market and service kept", async ({
    page,
  }) => {
    await page.goto(url("/lp/houston/flat-tire"));
    await page.getByLabel(/Your address/).fill("800 Bagby St");
    await page.getByRole("button", { name: "Continue" }).click();
    // RSOS-116: the address came first, so screen 1's quick questions follow.
    await answerScreenOne(page, "flat-tire");
    await expect(
      page.getByRole("heading", { name: "Who should the provider look for?" }),
    ).toBeVisible();
  });
});
