import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-107: without keys every platform is "Not connected" and nothing errors; the Marketing
// page shows the ads dashboard; the cron jobs refuse calls without CRON_SECRET.
const admin = appUrls.admin;

test.describe("ad sync", () => {
  test.skip(!admin, "No admin URL");
  // Demo sign-in retries for up to 50 seconds on a slow cold start; leave room for it.
  test.describe.configure({ timeout: 90_000 });

  test("Connections without keys: Not connected, and Test connection says so", async ({ page }) => {
    await signInAsDemo(page, admin!, "Marketing");
    await page.goto(new URL("/marketing/connections", admin).toString());
    await expect(page.getByRole("heading", { name: "Ad connections", level: 1 })).toBeVisible();
    for (const p of ["Google Ads", "Meta", "Microsoft Ads"])
      await expect(
        page
          .locator("li", { has: page.getByRole("heading", { name: p }) })
          .getByText("Not connected"),
      ).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page
      .locator("li", { has: page.getByRole("heading", { name: "Meta" }) })
      .getByRole("button", { name: "Test connection" })
      .click();
    await expect(
      page.getByText("Not connected: its keys are not set on the server."),
    ).toBeVisible();
  });

  test("the Marketing page shows ads by market and channel, with a CSV export", async ({
    page,
  }) => {
    await signInAsDemo(page, admin!, "Marketing");
    await page.goto(new URL("/marketing", admin).toString());
    await expect(page.getByRole("heading", { name: "Ads by market and channel" })).toBeVisible();
    const csv = page.getByRole("link", { name: "Download CSV" });
    const res = await page.request.get(
      new URL((await csv.getAttribute("href"))!, admin).toString(),
    );
    expect(res.status()).toBe(200);
    expect((await res.text()).split("\n")[0]).toBe(
      "day,market,channel,spend_usd,clicks,calls,qualified_calls,requests,assigned,completed,fees_usd",
    );
    await expectNoA11yViolations(page);
  });

  test("cron jobs refuse calls without the secret", async ({ request }) => {
    for (const job of ["spend", "conversions", "autopause", "daily-email"])
      expect((await request.get(new URL(`/api/cron/ads/${job}`, admin).toString())).status()).toBe(
        401,
      );
  });
});
