import { type Page, test } from "@playwright/test";

/**
 * Signs in with "Sign in as demo" (previews and staging only). The admin demo accounts are shared
 * and Supabase accepts each authenticator code once, so parallel admin sign-ins can collide in
 * the same 30 s window: if the page is still on sign-in, try again (up to three times).
 */
export async function signInAsDemo(
  page: Page,
  base: string,
  role: "Provider owner" | "Provider operator" | "Super admin" | "Dispatcher",
) {
  for (let attempt = 1; ; attempt++) {
    await page.goto(new URL("/sign-in", base).toString());
    await page.getByRole("button", { name: role }).click();
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 50_000 });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      // Give the test the time this retry takes.
      test.info().setTimeout(test.info().timeout + 60_000);
    }
  }
  await page.waitForLoadState("load");
}
