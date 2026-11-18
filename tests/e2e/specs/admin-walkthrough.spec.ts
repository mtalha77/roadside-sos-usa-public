import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-098: walkthrough page with every screen in job order, and "Run full demo".
const base = appUrls.admin;

test.describe("admin walkthrough", () => {
  test.skip(!base, "No admin URL");

  test("lists every screen and links one fresh demo job across the apps", async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Owner");
    await page.goto(new URL("/walkthrough", base).toString());
    await expect(
      page.getByRole("heading", { name: "Staging walkthrough", level: 1 }),
    ).toBeVisible();
    for (const group of ["1. Driver", "2. Provider", "3. Admin"])
      await expect(page.getByRole("heading", { name: group })).toBeVisible();
    const driver = page.getByRole("link", { name: "Open the driver's view" });
    const admin = page.getByRole("link", { name: "Open the admin view" });
    const token = (await driver.getAttribute("href"))!.split("/r/")[1];
    expect(token).toMatch(/^demo_/);
    expect(await admin.getAttribute("href")).toContain(token!);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-walkthrough.png"), fullPage: true });
    await page.goto(new URL(`/requests/${token}`, base).toString());
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  });
});
