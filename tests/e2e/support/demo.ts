import { type Page, test } from "@playwright/test";

/** Signs in with "Sign in as demo" (previews and staging only). */
export async function signInAsDemo(
  page: Page,
  base: string,
  role: "Provider owner" | "Provider operator" | "Super admin" | "Dispatcher",
) {
  if (role === "Super admin" || role === "Dispatcher") {
    // Admin demo accounts need the admin project's server key (BLOCKER while it is wrong).
    const health = await page.request.get(new URL("/api/health", base).toString());
    const body = (await health.json().catch(() => ({}))) as { demoSignIn?: string };
    test.skip(
      body.demoSignIn === "unavailable",
      "Admin demo sign-in unavailable: see BLOCKERS (keys)",
    );
  }
  await page.goto(new URL("/sign-in", base).toString());
  await page.getByRole("button", { name: role }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30_000 });
  await page.waitForLoadState("load");
}
