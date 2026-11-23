import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-062 and 063: notification settings, help center search and chat with dispatch.
const base = appUrls.provider;
const url = (p: string) => new URL(p, base).toString();

test.describe("provider notifications and help", () => {
  test.skip(!base, "No provider URL");

  test("notification channels, test alert, help search and chat", async ({ page }, info) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Provider owner");
    await page.goto(url("/notifications"));
    await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Send a test alert" }).click();
    await expect(page.getByText("Test alert played on this device.")).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("provider-notifications.png"), fullPage: true });

    await page.goto(url("/help?q=wallet"));
    await expect(page.getByText("Wallet and top-ups")).toBeVisible();
    await expect(page.getByText("Adding operators")).toHaveCount(0);
    await expectNoA11yViolations(page);
    await page.screenshot({ path: info.outputPath("provider-help.png"), fullPage: true });

    await page.goto(url("/help/chat"));
    await page.getByLabel("Message").fill("Driver isn't answering");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/Thanks, we're on it/)).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
