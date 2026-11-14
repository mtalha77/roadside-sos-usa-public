import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-021: the real request flow on the preview (rsos-dev, demo mode: the code is shown on screen).
const web = appUrls.web;
const url = (p: string) => new URL(p, web).toString();

test.describe("get help flow", () => {
  test.skip(!web, "No website URL");

  test("a first-time driver sends a request in under 60 seconds", async ({ page }, info) => {
    test.skip(readOnly, "Writes to the database");
    test.setTimeout(90_000);
    const started = Date.now();
    await page.goto(url("/get-help"));
    await expectNoA11yViolations(page);
    await page.getByLabel("Street address or cross streets").fill("1200 Main St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "What happened?" })).toBeVisible();
    await page.locator("label").filter({ hasText: "Flat tire" }).click();
    await page.getByRole("radio", { name: "Yes" }).check();
    await page.screenshot({ path: info.outputPath("problem.png"), fullPage: true });
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "What are you driving?" })).toBeVisible();
    await page.getByLabel("Make").fill("Toyota");
    await page.getByLabel("Model").fill("Camry");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Are you safe?" })).toBeVisible();
    await page
      .getByRole("group", { name: /safe place/ })
      .getByRole("radio", { name: "No" })
      .check();
    await expect(page.getByText(/call 911 first/)).toBeVisible();
    await page
      .getByRole("group", { name: /safe place/ })
      .getByRole("radio", { name: "Yes" })
      .check();
    await page
      .getByRole("group", { name: /highway/ })
      .getByRole("radio", { name: "No" })
      .check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: /reach you/ })).toBeVisible();
    await page.getByLabel("Your name").fill("E2E Driver");
    await page
      .getByLabel("Mobile number")
      .fill(`(210) 555-01${String(Math.floor(Math.random() * 90) + 10)}`);
    await page.getByRole("button", { name: "Text me a code" }).click();

    await expect(page.getByRole("heading", { name: "Enter the 6-digit code" })).toBeVisible();
    const code = /code is (\d{6})/.exec(
      (await page.getByText(/Your code is/).textContent()) ?? "",
    )?.[1];
    await page.getByLabel("Code").fill(code!);
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/);
    expect(Date.now() - started).toBeLessThan(60_000);
  });

  test("a reload keeps the driver's place, and denied location falls back to the address form", async ({
    page,
    context,
  }) => {
    await context.grantPermissions([]);
    await page.goto(url("/get-help"));
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByText(/couldn't get your location/)).toBeVisible();
    await expect(page.getByLabel("Street address or cross streets")).toBeFocused();
    await page.getByLabel("Street address or cross streets").fill("500 Commerce St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What happened?" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "What happened?" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.getByLabel("Street address or cross streets")).toHaveValue("500 Commerce St");
  });
});
