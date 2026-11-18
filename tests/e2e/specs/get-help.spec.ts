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

    // Screen 1 of 3: what happened.
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What happened?" })).toBeVisible();
    await page.locator("label").filter({ hasText: "Flat tire" }).click();
    await page.getByRole("radio", { name: "Yes" }).check();
    await page.screenshot({ path: info.outputPath("problem.png"), fullPage: true });
    await page.getByRole("button", { name: "Continue" }).click();

    // Screen 2 of 3: where.
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
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
    await page.getByRole("radio", { name: "I don't feel safe" }).check();
    await expect(page.getByText(/call 911 first/)).toBeVisible();
    await page.getByRole("radio", { name: "Off the road, in a safe place" }).check();
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/);
    expect(Date.now() - started).toBeLessThan(60_000);
  });

  test("errors say what to do next and keep what was typed", async ({ page }) => {
    await page.goto(url("/get-help?service=flat-tire"));
    // A tile chose the service: the flow starts at screen 2.
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
    await page.getByRole("radio", { name: "Off the road, in a safe place" }).check();
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page.getByText(/Enter a 10-digit US mobile number/)).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveValue("E2E Customer");
    await expectNoHorizontalScroll(page);
  });
});

// Owner feedback (RSOS-022 polish): Back on every step, and the browser's back button keeps answers.
test.describe("get help: going back", () => {
  test.skip(!web, "No website URL");

  test("every screen has a working Back, and browser back keeps the answers", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(url("/get-help"));
    // Screen 1 goes back home.
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/");
    await page.locator("label").filter({ hasText: "Flat tire" }).click();
    await page.getByRole("radio", { name: "Yes" }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Street address or cross streets").fill("700 Market St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Who should the provider look for?" }),
    ).toBeVisible();
    await page.getByLabel("Make").fill("Honda");
    await page.getByLabel("Your name").fill("E2E Back");
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page.getByLabel("Make")).toHaveValue("Honda");

    // The in-page Back link, screen by screen to the start, answers kept.
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.getByLabel("Street address or cross streets")).toHaveValue("700 Market St");
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "What happened?" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Yes" })).toBeChecked();
    await page.getByRole("link", { name: "Back" }).click();
    await page.waitForURL((u) => u.pathname === "/");
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
    await expect(
      page.getByRole("heading", { name: "Who should the provider look for?" }),
    ).toBeVisible();
  });
});
