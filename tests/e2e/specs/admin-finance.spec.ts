import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-079: finance ledger, revenue breakdowns, disputes, Stripe placeholder and CSV export.
const base = appUrls.admin;
const url = (p: string) => new URL(p, base).toString();

test.describe("admin finance", () => {
  test.skip(!base, "No admin URL");

  test("ledger, revenue and export", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Super admin");
    await page.goto(url("/finance"));
    await expect(page.getByRole("heading", { name: "Finance", level: 1 })).toBeVisible();
    await expect(page.getByRole("table", { name: "Ledger" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-finance.png"), fullPage: true });
    await page.getByRole("link", { name: "Revenue" }).click();
    await expect(page.getByRole("heading", { name: /by market/ })).toBeVisible();
    await expectNoA11yViolations(page);
    const csv = await page.request.get(url("/finance/export"));
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("date,market,provider,type,job,amount_usd");
  });
});
