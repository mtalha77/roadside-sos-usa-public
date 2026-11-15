import type { Page } from "@playwright/test";

/** Signs in with "Sign in as demo" (previews and staging only). */
export async function signInAsDemo(
  page: Page,
  base: string,
  role: "Provider owner" | "Provider operator" | "Super admin" | "Dispatcher",
) {
  await page.goto(new URL("/sign-in", base).toString());
  await page.getByRole("button", { name: role }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30_000 });
}
