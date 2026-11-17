import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// Batch 4 scope change from the owner: no Google Maps and no SMS. Typed addresses are checked for
// format only (no autocomplete, no geocoding), the Places endpoint is off, and sign-in uses email
// codes (demo accounts see their code on screen; nothing is emailed from tests).

test.describe("typed addresses", () => {
  test.skip(!appUrls.web, "No website URL");

  test("a plain address field: badly formed addresses are refused, good ones continue", async ({
    page,
  }) => {
    await page.goto(new URL("/get-help", appUrls.web).toString());
    await page.getByLabel("City").selectOption({ index: 1 });
    const field = page.getByLabel("Street address or cross streets");
    await field.fill("somewhere");
    await expect(
      page.getByRole("combobox", { name: "Street address or cross streets" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Type a street address with a number/)).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByLabel("Street address or cross streets").fill("1200 Main St");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What happened?" })).toBeVisible();
  });

  test("the Places endpoint is off while Google Maps is off, and never exposes a key", async ({
    request,
  }) => {
    const res = await request.get(
      new URL("/api/places?q=1200%20Main%20St", appUrls.web!).toString(),
    );
    expect(res.status()).toBe(404);
    const body = await res.text();
    expect(body).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(JSON.parse(body)).toEqual({ suggestions: [] });
  });
});

test.describe("sign in with an email code", () => {
  test.skip(!appUrls.provider, "No provider URL");

  test("a demo provider signs in with an emailed code (shown on demo hosts)", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    // Make sure the demo owner account exists.
    const setup = await browser.newContext();
    await signInAsDemo(await setup.newPage(), appUrls.provider!, "Provider owner");
    await setup.close();

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(new URL("/sign-in", appUrls.provider).toString());
    await page.getByRole("tab", { name: "Email code" }).click();
    await page.getByLabel("Email", { exact: true }).fill("demo-provider-owner@example.com");
    await page.getByRole("button", { name: "Email me a code" }).click();
    const shown = page.getByText(/no email is sent\. Use code \d{6}/);
    await expect(shown).toBeVisible();
    const code = /code (\d{6})/.exec((await shown.textContent()) ?? "")?.[1];
    await expectNoA11yViolations(page);
    await page.getByLabel("6-digit code").fill(code === "123456" ? "654321" : "123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That code didn't work.", { exact: false })).toBeVisible();
    await page.getByLabel("6-digit code").fill(code!);
    await page.getByRole("button", { name: "Sign in" }).click();
    // Signed in: the home screen, or the account's second step on a new device (the email code is
    // the first factor only).
    await page.waitForURL(
      (u) => u.pathname === "/" || u.pathname.startsWith("/sign-in/second-step"),
      { timeout: 30_000 },
    );
    await ctx.close();
  });

  test("an address without an account gets the same answer and no code opens it", async ({
    page,
  }) => {
    await page.goto(new URL("/sign-in", appUrls.provider).toString());
    await page.getByRole("tab", { name: "Email code" }).click();
    await page.getByLabel("Email", { exact: true }).fill("nobody-e2e@example.com");
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page.getByText(/If an account uses that email/)).toBeVisible();
    await expect(page.getByText(/Use code/)).toHaveCount(0);
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That code didn't work.", { exact: false })).toBeVisible();
  });
});
