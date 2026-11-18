import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-104: the portal menu follows the role. Technicians see only "My jobs" and the active job;
// pages for the office send them back to their jobs.
const base = appUrls.provider;
const url = (p: string) => new URL(p, base).toString();

test.describe("provider portal roles", () => {
  test.skip(!base, "No provider URL");

  test("a technician sees only My jobs", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Technician");
    await expect(page).toHaveURL(/\/jobs/);
    await expect(page.getByRole("heading", { name: "My jobs", level: 1 })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Portal" });
    await expect(nav.getByRole("link", { name: "My jobs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Wallet" })).toHaveCount(0);
    for (const path of ["/", "/wallet", "/offer", "/team"]) {
      await page.goto(url(path));
      await expect(page).toHaveURL(/\/jobs/);
    }
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("provider-technician.png"), fullPage: true });
  });

  test("a dispatcher quotes but does not manage the team", async ({ page }) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider dispatcher");
    await page.goto(url("/team"));
    await expect(page).toHaveURL(/\/no-access/);
    await page.goto(url("/offer"));
    await expect(page.getByRole("heading", { name: "Incoming requests", level: 1 })).toBeVisible();
  });
});
