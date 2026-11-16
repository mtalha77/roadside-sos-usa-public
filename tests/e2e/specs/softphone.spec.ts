import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-074b on previews (no Twilio keys): the dock shows on every admin screen in demo mode, the
// presence switch is saved, and the TwiML App endpoint rejects unsigned requests.

test.describe("softphone dock", () => {
  test.skip(!appUrls.admin, "No admin URL");

  test("the dock is on every screen and presence is saved", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, appUrls.admin!, "Dispatcher");
    const dock = page.getByRole("region", { name: "Phone" });
    await dock.getByRole("button", { name: /Phone · / }).click();
    await expect(dock.getByText(/Demo phone: Twilio is not connected/)).toBeVisible();
    await expectNoA11yViolations(page);
    await dock.getByLabel("Your status").selectOption("available");
    await page.reload();
    await expect(page.getByRole("button", { name: "Phone · Available" })).toBeVisible();
    await page.goto(new URL("/requests", appUrls.admin).toString());
    await expect(page.getByRole("button", { name: "Phone · Available" })).toBeVisible();
    await page.getByRole("button", { name: "Phone · Available" }).click();
    await page.getByLabel("Your status").selectOption("away");
  });

  test("the TwiML App endpoint rejects unsigned requests", async ({ request }) => {
    const res = await request.post(new URL("/api/twilio/client", appUrls.admin).toString(), {
      form: { From: "client:u_x", To: "+12105550123" },
    });
    expect(res.status()).toBe(403);
  });
});
