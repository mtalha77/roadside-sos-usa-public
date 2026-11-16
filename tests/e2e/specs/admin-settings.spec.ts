import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  readOnly,
  test,
} from "../support/fixtures";

// RSOS-082, 083, 084, 094: content manager (real city intros), users, audit log, templates,
// business rules, feature flags and integrations.
const base = appUrls.admin;
const url = (p: string) => new URL(p, base).toString();

test.describe("admin content and settings", () => {
  test.skip(!base, "No admin URL");

  test("city intro preview and publish", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Super admin");
    await page.goto(url("/content"));
    await expect(page.getByRole("heading", { name: "Content", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-content.png"), fullPage: true });
    const intro = page.getByLabel(/city page intro$/).first();
    const text = await intro.inputValue();
    await expect(page.getByRole("region", { name: "Preview" }).first()).toContainText(
      text.slice(0, 30),
    );
    // Publishing writes real data: re-publish the same text, and never on staging runs.
    test.skip(readOnly || text.trim().length < 40, "Read-only run or no intro to re-publish");
    await page.getByRole("button", { name: "Publish" }).first().click();
    await expect(
      page.getByText("Published. The city page shows the new intro.").first(),
    ).toBeVisible();
  });

  test("users, audit log, templates, flags and integrations", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Super admin");
    await page.goto(url("/settings"));
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Audit log" }).click();
    await expect(page.getByRole("heading", { name: "Audit log", level: 2 })).toBeVisible();
    await page.getByRole("link", { name: "Message templates" }).click();
    await expect(page.getByText(/Preview with sample values/).first()).toBeVisible();
    await page.getByRole("link", { name: "Feature flags" }).click();
    await page.getByRole("switch", { name: /Featured slots/ }).click();
    await expect(page.getByText("Featured slots updated on this page.")).toBeVisible();
    await page.getByRole("link", { name: "Integrations" }).click();
    await expect(page.getByRole("heading", { name: "Stripe" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("admin-settings.png"), fullPage: true });
  });
});
