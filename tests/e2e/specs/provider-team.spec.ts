import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-060: team list, text invites, live map and job assignment.
const base = appUrls.provider;

test.describe("provider team", () => {
  test.skip(!base, "No provider URL");

  test("owner sees the team and can invite an operator", async ({ page }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(new URL("/team", base).toString());
    await expect(page.getByRole("heading", { name: "Team", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-team.png"), fullPage: true });
    await page.getByLabel("Name").fill("Test Operator");
    await page.getByLabel("Mobile number").fill("2105550123");
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Invite sent to Test Operator")).toBeVisible();
  });
});
