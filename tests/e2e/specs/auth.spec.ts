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
