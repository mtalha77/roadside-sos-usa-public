import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  readOnly,
  test,
} from "../support/fixtures";

// RSOS-115: wallet bonus credits. The owner sets a 50 USD signup bonus, a new provider (from a
// website application) is approved and gets it (or, when a fictional test phone was used before,
// is flagged as a possible duplicate business), the provider wallet shows both balances, and a bulk
// campaign preview shows recipients and the total before confirming. Spending credit on a won job,
// refunds, limits, expiry and reversal are proven in supabase/tests/034_wallet_credits.test.sql.
const admin = appUrls.admin;
const web = appUrls.web;
const provider = appUrls.provider;

test.describe("wallet credits", () => {
  test.skip(!admin, "No admin URL");

  test("signup bonus on approval, and a campaign preview before confirming", async ({
    page,
    browser,
  }) => {
    test.skip(readOnly || !web, "Writes to the database");
    test.setTimeout(180_000);
    await signInAsDemo(page, admin!, "Owner");

    // 1. A 50 USD signup bonus in every market in view (the application below picks one).
    await page.goto(new URL("/credits", admin).toString());
    await expect(page.getByRole("heading", { name: "Wallet credits", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    const forms = page.locator("#signup form");
    const count = await forms.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const form = page.locator("#signup form").nth(i);
      await form.getByRole("checkbox", { name: "Signup bonus on" }).check();
      await form.getByRole("spinbutton", { name: "Amount (USD)" }).fill("50");
      await form.getByRole("button", { name: /^Save / }).click();
      await expect(page.getByText("Signup bonus saved.")).toBeVisible();
    }

    // 2. A new business applies on the website (fictional details).
    const company = `E2E Credit Towing ${Date.now()}`;
    const phone = `(210) 555-01${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
    const site = await browser.newPage();
    await site.goto(new URL("/for-providers/apply", web).toString());
    await site.getByRole("textbox", { name: /Company name/ }).fill(company);
    await site.getByRole("textbox", { name: /Your name/ }).fill("E2E Tester");
    await site.getByRole("textbox", { name: /Mobile phone/ }).fill(phone);
    await site.getByRole("textbox", { name: /Email/ }).fill("credit-e2e@example.test");
    await site
      .getByRole("group", { name: /Cities you serve/ })
      .getByRole("checkbox")
      .first()
      .check();
    await site
      .getByRole("group", { name: /Services you offer/ })
      .getByRole("checkbox")
      .first()
      .check();
    await site.getByRole("spinbutton", { name: /Number of trucks/ }).fill("1");
    await site.getByRole("textbox", { name: /Insurance carrier/ }).fill("E2E Mutual");
    await expect(site.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await site.getByRole("button", { name: "Send application" }).click();
    await expect(site.getByText("We got your application")).toBeVisible();
    await site.close();

    // 3. Approving the application creates the provider (onboarding: nothing granted yet).
    await page.goto(new URL("/recruitment", admin).toString());
    const card = page.locator("li", { hasText: company });
    await card.getByRole("button", { name: "Approve" }).click();
    // Wait for the approval (it creates the provider) before leaving the page.
    await expect(page.getByText(`Approved and emailed: ${company}`)).toBeVisible({
      timeout: 30_000,
    });
    await page.goto(new URL(`/providers?q=${encodeURIComponent(company)}`, admin).toString());
    await page.getByRole("link", { name: company }).first().click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible();
    await expect(page.getByText("No wallet activity yet.")).toBeVisible();

    // 4. Approving the provider grants the bonus, shown on its wallet timeline.
    await page.getByRole("button", { name: "Approve provider" }).click();
    await expect(page.getByText("Provider approved.")).toBeVisible();
    await expect(
      page
        .getByText("Bonus credit added")
        .or(page.getByText(/Signup bonus waiting: this business shares an identifier/))
        .first(),
    ).toBeVisible();
    await expectNoA11yViolations(page);

    // 5. A campaign preview lists who receives it and the total, before anything is granted.
    await page.goto(new URL("/credits", admin).toString());
    const campaign = page.locator("#campaign");
    await campaign.getByRole("textbox", { name: "Campaign name" }).fill("E2E preview");
    await campaign.getByRole("spinbutton", { name: "Amount (USD)" }).fill("20");
    await campaign.getByRole("spinbutton", { name: /Total budget cap/ }).fill("40");
    await campaign.getByRole("button", { name: "Preview recipients" }).click();
    await expect(page).toHaveURL(/preview=1/);
    const preview = page.locator("#campaign [aria-live]");
    await expect(preview.getByRole("heading", { name: "Preview" })).toBeVisible();
    await expect(
      preview
        .getByText(/receive \$20\.00 each: \$\d+\.00 of the \$40\.00 budget/)
        .or(preview.getByText("Nobody matches this audience.")),
    ).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test("the provider wallet shows the paid balance and bonus credit separately", async ({
    page,
  }) => {
    test.skip(!provider, "No provider URL");
    await signInAsDemo(page, provider!, "Provider owner");
    await page.goto(new URL("/wallet", provider).toString());
    await expect(page.getByText("Paid balance", { exact: true }).first()).toBeVisible();
    // The label may carry a "Demo" tag next to it.
    await expect(page.getByText(/^Bonus credit/).first()).toBeVisible();
    await expect(page.getByText(/expires on/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wallet activity" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });

  test("finance sees the outstanding credit and can only view Wallet credits", async ({ page }) => {
    await signInAsDemo(page, admin!, "Finance");
    await page.goto(new URL("/finance", admin).toString());
    await expect(page.getByRole("heading", { name: "Outstanding bonus credit" })).toBeVisible();
    await page.goto(new URL("/credits", admin).toString());
    await expect(page.getByText("You can view wallet credits.")).toBeVisible();
  });
});
