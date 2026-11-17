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
    // The demo dispatcher is shared by the parallel browsers, so every run only sets Available.
    await dock.getByLabel("Your status").selectOption("available");
    const pill = page.getByRole("button", { name: "Phone · Available" });
    // Saved on the server: it survives a reload (retried while the save is still in flight).
    await expect(async () => {
      await page.reload();
      await expect(pill).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await page.goto(new URL("/requests", appUrls.admin).toString());
    await expect(pill).toBeVisible();
  });

  test("the TwiML App endpoint rejects unsigned requests", async ({ request }) => {
    const res = await request.post(new URL("/api/twilio/client", appUrls.admin).toString(), {
      form: { From: "client:u_x", To: "+12105550123" },
    });
    expect(res.status()).toBe(403);
  });
});
