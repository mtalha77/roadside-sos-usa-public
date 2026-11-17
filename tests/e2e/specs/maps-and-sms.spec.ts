import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-021b with the fake adapters (no Google or Twilio keys on previews): the address combobox,
// the Places endpoint, Verify-based SMS sign-in, and the fake never opening a real account.

test.describe("address suggestions", () => {
  test.skip(!appUrls.web, "No website URL");

  test("typing an address offers a suggestion that can be picked with the keyboard", async ({
    page,
  }) => {
    await page.goto(new URL("/get-help", appUrls.web).toString());
    await page.getByLabel("City").selectOption({ index: 1 });
    // A plain field until the driver types; then the suggestions combobox takes over.
    await page.getByLabel("Street address or cross streets").fill("1200 Main St");
    const box = page.getByRole("combobox", { name: "Street address or cross streets" });
    await expect(box).toHaveValue("1200 Main St");
    const option = page.getByRole("option", { name: /1200 Main St/ });
    await expect(option).toBeVisible();
    await expectNoA11yViolations(page);
    await box.press("ArrowDown");
    await box.press("Enter");
    await expect(option).toBeHidden();
    await expect(page.locator('input[name="placeId"]')).toHaveValue(/.+/);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What happened?" })).toBeVisible();
  });

  test("the Places endpoint validates input and never exposes a key", async ({ request }) => {
    const base = appUrls.web!;
    const short = await request.get(new URL("/api/places?q=ab", base).toString());
    expect(await short.json()).toEqual({ suggestions: [] });
    const res = await request.get(new URL("/api/places?q=1200%20Main%20St", base).toString());
    const body = await res.text();
    expect(body).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(JSON.parse(body).suggestions.length).toBeGreaterThan(0);
  });
});

test.describe("sign in with a text code", () => {
  test.skip(!appUrls.provider, "No provider URL");

  test("a demo provider signs in with a texted code (fake Verify)", async ({ browser }) => {
    test.setTimeout(120_000);
    // Make sure the demo owner account (and its phone) exists.
    const setup = await browser.newContext();
    await signInAsDemo(await setup.newPage(), appUrls.provider!, "Provider owner");
    await setup.close();

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(new URL("/sign-in", appUrls.provider).toString());
    await page.getByRole("tab", { name: "Text code" }).click();
    // Fictional 555-01xx number used only by the demo owner account.
    await page.getByLabel("Mobile number").fill("(210) 555-0191");
    await page.getByRole("button", { name: "Text me a code" }).click();
    await expect(page.getByText(/no text is sent\. Use code 000000/)).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That code didn't work.", { exact: false })).toBeVisible();
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Signed in: the home screen, or the account's second step on a new device (the text code is
    // the first factor only).
    await expect(
      page.getByRole("heading", { level: 1, name: /^(Today|Confirm it's you)$/ }),
    ).toBeVisible({ timeout: 30_000 });
    await ctx.close();
  });

  test("the fake code never opens a number without a demo account", async ({ page }) => {
    await page.goto(new URL("/sign-in", appUrls.provider).toString());
    await page.getByRole("tab", { name: "Text code" }).click();
    await page.getByLabel("Mobile number").fill("(210) 555-0177");
    await page.getByRole("button", { name: "Text me a code" }).click();
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/No account uses this number/)).toBeVisible();
  });
});
