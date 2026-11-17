import { createHmac, randomBytes } from "node:crypto";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, readOnly, test } from "../support/fixtures";

// RSOS-034b on previews (fake Twilio, no SMS in batch 4): a missed call to a tracking number opens
// an urgent intake in the live inbox; a dispatcher claims it, records the intake, reads the
// location link on the call (no email on the request) and walks the manual steps. Signed with the
// published test token (never accepted in production).

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

  test("a missed call becomes an urgent inbox item that a dispatcher works to the end", async ({
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
    await page.getByRole("textbox", { name: "Number", exact: true }).fill(tracking);
    await page.getByLabel("Source").selectOption("staging_test");
    await page.getByRole("button", { name: "Add number" }).click();
    await expect(
      page.getByText(`Added ${tracking}.`).or(page.getByText("That number is already tracked.")),
    ).toBeVisible();

    // The driver calls the number and nobody answers: a missed call.
    const post = (path: string, params: Record<string, string>, signed = true) => {
      const url = new URL(path, appUrls.admin).toString();
      return request.post(url, {
        form: params,
        headers: signed ? { "X-Twilio-Signature": sign(url, params) } : {},
      });
    };
    const CallSid = `CA${randomBytes(16).toString("hex")}`;
    const ring = { CallSid, From: driver, To: tracking, CallStatus: "ringing" };
    expect((await post("/api/twilio/voice", ring)).status()).toBe(200);
    expect((await post("/api/twilio/voice", ring, false)).status()).toBe(403);
    expect(
      (
        await post("/api/twilio/voice/status", {
          CallSid,
          CallStatus: "completed",
          CallDuration: "5",
        })
      ).status(),
    ).toBe(204);

    // It shows up in the inbox, urgent.
    await page.goto(new URL("/inbox", appUrls.admin).toString());
    const item = page.getByRole("link", { name: new RegExp(driver.slice(-4)) }).first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    await expect(item.getByText("Urgent")).toBeVisible();
    await expectNoA11yViolations(page);
    await item.click();

    const panel = page.getByRole("article");
    await panel.getByRole("button", { name: "Claim" }).click();
    await expect(panel.getByText("You are handling this.")).toBeVisible();
    await panel.getByRole("button", { name: "Mark contacted" }).click();
    await expect(panel.getByRole("button", { name: "Location confirmed" })).toBeVisible();

    // Intake: name, service and address (the fake geocoder places it at the market centre).
    await panel.getByLabel("Name").fill("E2E Driver");
    await panel.locator("select[name=service]").selectOption({ index: 1 });
    await panel.getByLabel("Address or cross streets").fill("1200 Main St");
    await panel.getByRole("button", { name: "Save intake" }).click();
    await expect(panel.getByText("Saved.").first()).toBeVisible();
    await panel.getByRole("button", { name: "Location confirmed" }).click();
    await expect(panel.getByRole("button", { name: "On the way" })).toBeVisible();

    // No email on a phone request: the location link is read on the call and logged.
    await panel.getByRole("button", { name: "Location link" }).click();
    await expect(panel.getByText(/and type the code \d{3} \d{3}/)).toBeVisible();
    await panel.getByRole("button", { name: "I read it to the driver" }).click();
    await expect(panel.getByText("Logged on the timeline.")).toBeVisible();

    // Ending needs a reason.
    await panel.getByRole("button", { name: "No provider found" }).click();
    await panel.getByLabel("Reason (required)").fill("E2E test: no provider nearby");
    await panel.getByRole("button", { name: "No provider found" }).last().click();
    await expect(panel.getByText("Reason: E2E test: no provider nearby")).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
