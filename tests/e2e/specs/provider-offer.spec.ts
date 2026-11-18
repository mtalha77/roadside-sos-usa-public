import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-054 + 104: full-screen incoming request; price from the price table, arrival chips, one
// "Send quote" button (demo scenario).
const base = appUrls.provider;

test.describe("provider incoming request", () => {
  test.skip(!base, "No provider URL");

  test("one tap sends the pre-filled quote", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/offer", base).toString());
    await expect(page.getByRole("heading", { name: "Incoming requests", level: 1 })).toBeVisible();
    await expect(page.getByText("Exact address hidden until you're picked.").first()).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-offer.png"), fullPage: true });
    // Arrival chips: 15, 30, 45 and 60 minutes; one is always chosen.
    for (const m of ["15 min", "30 min", "45 min", "60 min"])
      await expect(page.getByRole("radio", { name: m }).first()).toBeAttached();
    await page.getByText("30 min", { exact: true }).first().click();
    await expect(
      page.getByRole("button", { name: /^Send quote · .* · 30 min$/ }).first(),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: /^Send quote/ })
      .first()
      .click();
    await expect(
      page.getByText(/Quote sent: .*Waiting for the customer to choose\./),
    ).toBeVisible();
  });
});
