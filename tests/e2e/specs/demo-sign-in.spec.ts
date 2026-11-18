import { signInAsDemo } from "../support/demo";
import { appUrls, expect, test } from "../support/fixtures";

// Smoke test: "Sign in as demo" works for every demo role. Unlike the screen tests, this one never
// skips: if the demo accounts cannot be created (for example a wrong server key in Vercel), it
// fails, so Release QA catches it before anything ships. Tagged @smoke.

const roles = [
  { app: "admin", role: "Owner", landing: "Today" },
  { app: "admin", role: "Operations manager", landing: "Today" },
  { app: "admin", role: "Dispatcher", landing: "Today" },
  { app: "admin", role: "Provider success", landing: "Today" },
  { app: "admin", role: "Finance", landing: "Today" },
  { app: "admin", role: "Marketing", landing: "Today" },
  { app: "admin", role: "Viewer", landing: "Today" },
  { app: "provider", role: "Provider owner", landing: "Today" },
  { app: "provider", role: "Provider dispatcher", landing: "Today" },
  { app: "provider", role: "Technician", landing: "My jobs" },
] as const;

test.describe("demo sign-in @smoke", () => {
  test("the admin can reach Supabase for demo accounts @smoke", async ({ request }) => {
    test.skip(!appUrls.admin, "No admin URL");
    const res = await request.get(new URL("/api/health", appUrls.admin).toString());
    expect(res.status()).toBe(200);
    expect(((await res.json()) as { demoSignIn?: string }).demoSignIn).toBe("ok");
  });

  for (const r of roles) {
    test(`${r.role} signs in @smoke`, async ({ page }) => {
      const base = appUrls[r.app];
      test.skip(!base, `No ${r.app} URL`);
      test.setTimeout(90_000);
      await signInAsDemo(page, base!, r.role);
      await expect(page.getByRole("heading", { name: r.landing, level: 1 })).toBeVisible();
      if (r.role === "Technician")
        await expect(page.getByRole("link", { name: "Wallet" })).toHaveCount(0);
    });
  }
});
