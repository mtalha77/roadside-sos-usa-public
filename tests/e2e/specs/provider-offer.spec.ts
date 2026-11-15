import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-054: incoming request, quote sent in one tap with the defaults (demo scenario).
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
    await page
      .getByRole("button", { name: /^Send / })
      .first()
      .click();
    await expect(page.getByText(/Quote sent: .*Waiting for the driver to choose\./)).toBeVisible();
  });
});
