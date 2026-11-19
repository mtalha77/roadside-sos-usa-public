import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, readOnly, test } from "../support/fixtures";

// Owner decision 2: test traffic. ?rsos_test=1 marks the browser session; staff manage the test
// list in Settings > System; Analytics can include test traffic on purpose (staging and previews).
const web = appUrls.web;
const admin = appUrls.admin;

test("?rsos_test=1 marks this browser session as test traffic", async ({ page, context }) => {
  test.skip(!web, "No website URL");
  await page.goto(new URL("/?rsos_test=1", web).toString());
  const cookie = (await context.cookies()).find((c) => c.name === "rsos_test");
  expect(cookie?.value).toBe("1");
  expect(cookie?.httpOnly).toBe(true);
  // A session cookie: it ends with the browser session.
  expect(cookie?.expires).toBe(-1);
});

test("staff manage the test list; Analytics offers to include test traffic", async ({ page }) => {
  test.skip(!admin || readOnly, "Needs the admin; writes to the database");
  await signInAsDemo(page, admin!, "Owner");
  await page.goto(new URL("/settings?tab=system", admin).toString());
  const section = page.locator("#test-traffic");
  await expect(section.getByRole("heading", { name: "Test traffic" })).toBeVisible();
  const label = `E2E office ${Date.now()}`;
  await section.getByLabel("IP address or range (CIDR)").fill("198.51.100.0/24");
  await section.getByLabel("Label").first().fill(label);
  await section.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByText("Added to the test list.").or(page.getByText(/Check the values/)),
  ).toBeVisible();
  await expectNoA11yViolations(page);
  const row = page.locator("#test-traffic li", { hasText: label });
  if (await row.count()) {
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Removed from the test list.")).toBeVisible();
  }
  await page.goto(new URL("/analytics", admin).toString());
  await page.getByRole("link", { name: "Include test traffic" }).click();
  await expect(page).toHaveURL(/test=1/);
});
