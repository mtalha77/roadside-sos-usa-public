import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-114: provider plans and Featured placement. The public pricing page, the provider's Plan &
// billing (start Pro with fake billing, discounted fees), and the admin price change preview with
// grandfathering. Featured placement and rotation are unit tested in packages/core.

test.describe("plans and Featured", () => {
  test("public pricing page: three plans, break-even line, FAQ, start with Basic", async ({
    page,
  }, info) => {
    const web = appUrls.web;
    test.skip(!web, "No website URL");
    await page.goto(new URL("/for-providers#fp-plans", web).toString());
    await expect(page.getByRole("heading", { name: "Plans", level: 2 })).toBeVisible();
    for (const name of ["Basic", "Pro", "Featured"])
      await expect(page.getByRole("heading", { name, level: 3, exact: true })).toBeVisible();
    await expect(page.getByText(/Pro pays for itself at about \d+ jobs a month/)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Start with Basic/ })).toBeVisible();
    await page.getByText("When am I charged?").click();
    await expect(page.getByText(/only when the customer picks you/)).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("for-providers-plans.png"), fullPage: true });
  });

  test("provider starts Pro and sees the discounted fees", async ({ page }, info) => {
    const base = appUrls.provider;
    test.skip(!base, "No provider URL");
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/plan", base).toString());
    await expect(page.getByRole("heading", { name: "Plan & billing", level: 1 })).toBeVisible();
    const upgrade = page.getByRole("button", { name: /^(Upgrade to Pro now|Start Pro)$/ });
    if (await upgrade.isVisible()) {
      await upgrade.click();
      await expect(
        page.getByText("You're on Pro. The discount applies to your next job."),
      ).toBeVisible();
    }
    const proCard = page
      .locator("#plans li")
      .filter({ has: page.getByRole("heading", { name: "Pro" }) });
    await expect(proCard.getByText("Your plan")).toBeVisible();
    const fees = page.getByRole("region", { name: "Fee per job you win" });
    await expect(fees).toBeVisible();
    // Every Pro fee is 15% below the Basic fee in the same row.
    const rows = await fees.locator("tbody tr").all();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const [basic, pro] = (await row.locator("td").allInnerTexts()).map((v) =>
        Number(v.replace(/[^0-9.]/g, "")),
      );
      expect(pro).toBeCloseTo(basic! * 0.85, 1);
    }
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-plan.png"), fullPage: true });
  });

  test("admin previews a Pro price change that keeps existing subscribers on their price", async ({
    page,
  }, info) => {
    const base = appUrls.admin;
    test.skip(!base, "No admin URL");
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Owner");
    await page.goto(new URL("/plans", base).toString());
    await expect(page.getByRole("heading", { name: "Plans & pricing", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByLabel("Plan", { exact: true }).first().selectOption("pro");
    await page.getByLabel("New monthly price (USD)").fill("149");
    await page.getByLabel("Existing subscribers").selectOption("grandfather");
    await page.getByRole("button", { name: "Preview who is affected" }).click();
    await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
    await expect(page.getByText(/New subscribers pay \$149/)).toBeVisible();
    const preview = page.getByRole("region", { name: "Preview" });
    if (await preview.isVisible())
      for (const cell of await preview.locator("tbody td:last-child").allInnerTexts())
        expect(cell).toBe("kept old price");
    await expect(page.getByRole("button", { name: "Confirm the new price" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-plans.png"), fullPage: true });
  });
});
