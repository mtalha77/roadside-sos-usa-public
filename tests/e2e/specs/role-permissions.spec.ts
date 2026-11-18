import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-102: what each staff role can open. The proxy refuses sections outside the role (not just
// the menu hiding them); the database enforces the same with RLS (supabase/tests/027).

const admin = appUrls.admin;
const url = (p: string) => new URL(p, admin).toString();

const matrix = [
  {
    role: "Dispatcher",
    allowed: ["/inbox", "/dispatch", "/providers"],
    denied: ["/finance", "/pricing", "/content", "/settings", "/team"],
  },
  {
    role: "Marketing",
    allowed: ["/marketing", "/content"],
    denied: ["/finance", "/dispatch", "/team"],
  },
  {
    role: "Finance",
    allowed: ["/finance", "/requests"],
    denied: ["/dispatch", "/content", "/team"],
  },
  { role: "Viewer", allowed: ["/analytics", "/finance"], denied: ["/inbox", "/team", "/settings"] },
] as const;

test.describe("roles and permissions", () => {
  test.skip(!admin, "No admin URL");

  for (const m of matrix) {
    test(`${m.role}: only their sections`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop-chrome", "One browser is enough for the matrix");
      test.setTimeout(180_000);
      await signInAsDemo(page, admin!, m.role);
      for (const path of m.allowed) {
        await page.goto(url(path));
        await expect(page).not.toHaveURL(/\/no-access/);
      }
      for (const path of m.denied) {
        await page.goto(url(path));
        await expect(page).toHaveURL(/\/no-access/);
      }
      // The menu shows only what the role can use.
      await page.goto(url("/"));
      const nav = page.getByRole("navigation").first();
      for (const path of m.denied) await expect(nav.locator(`a[href="${path}"]`)).toHaveCount(0);
    });
  }

  test("the owner sees Team and roles with every role explained", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, admin!, "Owner");
    await page.goto(url("/team"));
    await expect(page.getByRole("heading", { name: "Team and roles", level: 1 })).toBeVisible();
    for (const role of [
      "Owner",
      "Operations manager",
      "Dispatcher",
      "Provider success",
      "Finance",
      "Marketing",
      "Viewer",
    ])
      await expect(
        page.getByRole("region", { name: "Staff roles" }).getByText(role, { exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Provider roles" }).getByText("Technician", { exact: true }),
    ).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
