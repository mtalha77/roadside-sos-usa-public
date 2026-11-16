import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-057: wallet balance, top-up sheet (payments wait for Stripe), transactions and plans.
const base = appUrls.provider;

test.describe("provider wallet", () => {
  test.skip(!base, "No provider URL");

  test("balance, top-up sheet, transactions and statement", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/wallet", base).toString());
    await expect(page.getByRole("heading", { name: "Wallet", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-wallet.png"), fullPage: true });
    await page.getByRole("button", { name: "Top up" }).click();
    await expect(page.getByRole("dialog", { name: "Add money to your wallet" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.keyboard.press("Escape");
    const csv = await page.request.get(new URL("/wallet/statement", base).toString());
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("date,type,amount_usd,job");
  });
});
