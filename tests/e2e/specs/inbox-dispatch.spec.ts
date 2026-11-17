import { createHmac, randomBytes } from "node:crypto";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, readOnly, test } from "../support/fixtures";

// RSOS-034b on previews (fake Twilio): a text to a tracking number opens an urgent intake in the
// live inbox; a dispatcher claims it, records the intake, and walks the manual steps. Signed with
// the published test token (never accepted in production).

const FAKE_TOKEN = "fake-twilio-auth-token-for-tests";
const sign = (url: string, params: Record<string, string>) =>
  createHmac("sha1", FAKE_TOKEN)
    .update(
      Object.keys(params)
        .sort()
        .reduce((acc, k) => acc + k + params[k], url),
    )
    .digest("base64");
const rand = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");

test.describe("inbox and manual dispatch", () => {
  test.skip(!appUrls.admin, "No admin URL");

  test("an incoming text becomes an urgent inbox item that a dispatcher works to completed", async ({
    page,
    request,
  }) => {
    test.skip(readOnly, "Writes to the database");
    test.setTimeout(180_000);
    await signInAsDemo(page, appUrls.admin!, "Super admin");

    // A tracking number for this test (fictional 555-01xx numbers).
    const tracking = `+1210555${rand(4).replace(/^./, "0")}`;
    const driver = `+1210555${rand(4).replace(/^./, "0")}`;
    await page.goto(new URL("/settings?tab=phones", appUrls.admin).toString());
    await page.getByLabel("Number").fill(tracking);
    await page.getByLabel("Source").selectOption("staging_test");
    await page.getByRole("button", { name: "Add number" }).click();
    await expect(page.getByText(`Added ${tracking}.`)).toBeVisible();

    // The driver texts the number.
    const url = new URL("/api/twilio/messages", appUrls.admin).toString();
    const params = {
      MessageSid: `SM${randomBytes(16).toString("hex")}`,
      From: driver,
      To: tracking,
      Body: "My car broke down near the exit",
    };
    const res = await request.post(url, { form: params, headers: { "X-Twilio-Signature": sign(url, params) } });
    expect(res.status()).toBe(200);
    expect((await request.post(url, { form: params })).status()).toBe(403);

    // It shows up in the inbox, urgent.
    await page.goto(new URL("/inbox", appUrls.admin).toString());
    const item = page.getByRole("link", { name: new RegExp(driver.slice(-4)) }).first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    await expect(item.getByText("Urgent")).toBeVisible();
    await expectNoA11yViolations(page);
    await item.click();

    const panel = page.getByRole("article");
    await expect(panel.getByText("My car broke down near the exit")).toBeVisible();
    await panel.getByRole("button", { name: "Claim" }).click();
    await expect(panel.getByText("You are handling this.")).toBeVisible();
    await panel.getByRole("button", { name: "Mark contacted" }).click();
    await expect(panel.getByRole("button", { name: "Location confirmed" })).toBeVisible();

    // Intake: name, service and address (the fake geocoder places it at the market centre).
    await panel.getByLabel("Name").fill("E2E Driver");
    await panel.getByLabel("Service", { exact: true }).selectOption({ index: 1 });
    await panel.getByLabel("Address or cross streets").fill("1200 Main St");
    await panel.getByRole("button", { name: "Save intake" }).click();
    await expect(panel.getByText("Saved.").first()).toBeVisible();
    await panel.getByRole("button", { name: "Location confirmed" }).click();
    await expect(panel.getByRole("button", { name: "On the way" })).toBeVisible();

    // A two-way text from the panel, with a saved reply.
    await panel.getByLabel("Saved replies").selectOption({ label: "Still looking" });
    await expect(panel.getByLabel("Message")).toHaveValue(/E2E Driver|still finding/);
    await panel.getByRole("button", { name: "Send text" }).click();
    await expect(panel.getByText(/still finding a provider/)).toBeVisible();

    // Ending needs a reason.
    await panel.getByRole("button", { name: "No provider found" }).click();
    await panel.getByLabel("Reason (required)").fill("E2E test: no provider nearby");
    await panel.getByRole("button", { name: "No provider found" }).last().click();
    await expect(panel.getByText("Reason: E2E test: no provider nearby")).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
