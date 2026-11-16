import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-076: recruitment board and table, CSV import and coverage per market.
const base = appUrls.admin;

test.describe("admin recruitment", () => {
  test.skip(!base, "No admin URL");

  test("board, table, CSV import and coverage", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Super admin");
    await page.goto(new URL("/recruitment", base).toString());
    await expect(page.getByRole("heading", { name: "Recruitment", level: 1 })).toBeVisible();
    await expect(page.getByText(/of 12 live providers/).first()).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("admin-recruitment.png"), fullPage: true });
    await page.getByLabel(/Import leads/).setInputFiles({
      name: "leads.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "company,contact,phone,market,trucks\nTest Tow (demo),Ana,2105550111,san-antonio,2\n",
      ),
    });
    await expect(page.getByText("Leads imported: 1.")).toBeVisible();
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByRole("rowheader", { name: "Test Tow (demo)" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
