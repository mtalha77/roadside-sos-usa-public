import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-073: request search and the full request page.
const base = appUrls.admin;

test.describe("admin requests", () => {
  test.skip(!base, "No admin URL");

  test("search and open a request with its timeline", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Dispatcher");
    await page.goto(new URL("/requests", base).toString());
    await expect(page.getByRole("heading", { name: "Requests", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    const first = page.getByRole("rowheader").getByRole("link").first();
    const code = (await first.textContent())!.trim();
    await page.getByLabel("Code, phone or name").fill(code);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("link", { name: code }).first().click();
    await expect(page.getByRole("heading", { name: `Request ${code}`, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    await page.getByLabel("Note", { exact: true }).fill("Called the driver back");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByRole("log", { name: "Action log" })).toContainText(
      "Called the driver back",
    );
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("admin-request-detail.png"), fullPage: true });
  });
});
