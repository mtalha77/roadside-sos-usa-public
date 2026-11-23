import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

for (const app of ["admin", "provider"] as const) {
  test.describe(`${app} sign-in`, () => {
    test.skip(!appUrls[app], `No URL for ${app}`);

    test("protected pages redirect to sign-in", async ({ page }) => {
      await page.goto(new URL("/requests", appUrls[app]).toString());
      await expect(page).toHaveURL(/\/sign-in\?next=%2Frequests$/);
      await expect(page.getByRole("textbox", { name: "Email" }).first()).toBeVisible();
      await expectNoA11yViolations(page);
    });

    test("wrong credentials show an error and never reach the app", async ({ page }) => {
      await page.goto(new URL("/sign-in", appUrls[app]).toString());
      await page.getByRole("textbox", { name: "Email" }).first().fill("nobody@example.test");
      await page.locator('input[name="password"]').fill("not-the-password-123");
      await page.getByRole("button", { name: app === "admin" ? "Continue" : "Sign in" }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: /Check your email and password/ }),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/sign-in/);
    });
  });
}

test("admin authenticator step cannot be skipped without a session", async ({ page }) => {
  test.skip(!appUrls.admin, "No admin URL");
  await page.goto(new URL("/sign-in/verify", appUrls.admin).toString());
  await expect(page).toHaveURL(/\/sign-in$/);
});

// RSOS-093: account and security flows that work without a signed-in user.
for (const app of ["admin", "provider"] as const) {
  test.describe(`${app} account recovery`, () => {
    test.skip(!appUrls[app], `No URL for ${app}`);

    test("forgot password: linked from sign-in, same answer for any email", async ({ page }) => {
      await page.goto(new URL("/sign-in", appUrls[app]).toString());
      await page.getByRole("link", { name: "Forgot your password?" }).click();
      await expect(page).toHaveURL(/\/forgot-password$/);
      await expectNoA11yViolations(page);
      await page.getByRole("textbox", { name: "Email" }).fill("nobody@example.test");
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: /If an account exists/ }),
      ).toBeVisible();
    });

    test("account pages need a session", async ({ page }) => {
      await page.goto(new URL("/account", appUrls[app]).toString());
      await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
    });

    test("a remotely signed-out session sees why it was signed out", async ({ page }) => {
      await page.goto(new URL("/sign-in?signedOut=1", appUrls[app]).toString());
      await expect(
        page.getByRole("status").filter({ hasText: /signed out from another device/ }),
      ).toBeVisible();
      await expectNoA11yViolations(page);
    });
  });
}

test("provider second step cannot be reached without a session", async ({ page }) => {
  test.skip(!appUrls.provider, "No provider URL");
  await page.goto(new URL("/sign-in/second-step", appUrls.provider).toString());
  await expect(page).toHaveURL(/\/sign-in$/);
});
