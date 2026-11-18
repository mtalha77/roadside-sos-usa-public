import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  readOnly,
  test,
} from "../support/fixtures";

// RSOS-070: driver account (demo mode), and a returning driver's quick request.
const web = appUrls.web;
const url = (p: string) => new URL(p, web).toString();

test.describe("driver account", () => {
  test.skip(!web, "No website URL");

  test("sign in with an email code; saved vehicles, places, favorites and history", async ({
    page,
  }, info) => {
    await page.goto(url("/account"));
    await page.getByLabel("Email", { exact: true }).fill("e2e-driver-44@example.com");
    await page.getByRole("button", { name: "Email me a code" }).click();
    const code = /code is (\d{6})/.exec(
      (await page.getByText(/your code is/).textContent()) ?? "",
    )?.[1];
    await page.getByLabel("6-digit code").fill(code!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Request again" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("account.png"), fullPage: true });
    for (const tab of ["Vehicles", "Places", "Favorite providers", "Settings"]) {
      await page.getByRole("link", { name: tab }).click();
      await expect(page.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
    }
  });

  test("a returning driver sends a request in 3 taps after location", async ({ page }) => {
    test.skip(readOnly, "Writes to the database");
    await page.goto(url("/account"));
    await page.getByLabel("Email", { exact: true }).fill("e2e-driver-45@example.com");
    await page.getByRole("button", { name: "Email me a code" }).click();
    const code = /code is (\d{6})/.exec(
      (await page.getByText(/your code is/).textContent()) ?? "",
    )?.[1];
    await page.getByLabel("6-digit code").fill(code!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Flat tire" }).first().click();
    // Location (the step the requirement excludes from the count).
    await page.getByLabel("Street address or cross streets").fill("1000 Louisiana St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    let taps = 0;
    // Saved name, number and vehicle are filled in: one tap for where they are, one to send.
    await page.getByRole("radio", { name: "Off the road, in a safe place" }).check();
    taps++;
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Send my request" }).click();
    taps++;
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/);
    expect(taps).toBeLessThanOrEqual(3);
  });
});

// RSOS-019b: provider public profile (demo providers in demo mode only).
test.describe("provider profile", () => {
  test.skip(!web, "No website URL");

  test("a demo provider's profile shows services, area, hours, payments and reviews", async ({
    page,
  }, info) => {
    await page.goto(url("/providers/magnolia-heron"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Magnolia Heron Roadside/);
    for (const h of ["Services and prices", "Hours", "Reviews"])
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    await expect(page.getByRole("img", { name: /Service area/ })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-profile.png"), fullPage: true });
    expect((await page.request.get(url("/providers/not-a-provider"))).status()).toBe(404);
  });
});
