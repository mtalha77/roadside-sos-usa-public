import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
  type AppName,
} from "../support/fixtures";

// Spanish is selected with the NEXT_LOCALE cookie. Longer Spanish text must not break layouts.
for (const app of Object.keys(appUrls) as AppName[]) {
  test(`${app} renders in Spanish without layout breaks`, async ({ page, context }) => {
    const url = appUrls[app];
    test.skip(!url, `No URL for ${app}`);
    await context.addCookies([{ name: "NEXT_LOCALE", value: "es", url: url! }]);
    await page.goto(url!, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });
}
