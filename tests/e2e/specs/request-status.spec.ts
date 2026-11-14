import { demoState, demoStream, type DemoStage } from "@rsos/core/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-022 and 065 to 069: every stage of /r/[token], using live demo requests from the shared engine.
const web = appUrls.web;
const url = (p: string) => new URL(p, web).toString();
const HEADINGS: Record<DemoStage, RegExp> = {
  searching: /Finding providers/,
  quoting: /Quotes are coming in/,
  picked: /Provider confirmed/,
  en_route: /On the way/,
  on_site: /Provider arrived/,
  completed: /Job completed/,
  cancelled: /Request cancelled/,
  expired: /No provider was available/,
};

function tokenAt(stage: DemoStage, minLeftSec = 25): string | null {
  const now = Date.now();
  for (const r of demoStream(now, { markets: ["houston", "san-antonio", "las-vegas"] })) {
    const s = demoState(r, now);
    const later = demoState(r, now + minLeftSec * 1000);
    if (s.stage === stage && later.stage === stage) return r.token;
  }
  return null;
}

test.describe("request status page", () => {
  test.skip(!web, "No website URL");

  for (const stage of [
    "searching",
    "quoting",
    "en_route",
    "on_site",
    "completed",
    "cancelled",
    "expired",
  ] as DemoStage[]) {
    test(`shows the ${stage} stage`, async ({ page }, info) => {
      const token = tokenAt(stage);
      test.skip(!token, `No demo request in the ${stage} stage right now`);
      await page.goto(url(`/r/${token}`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADINGS[stage]);
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page);
      await page.screenshot({ path: info.outputPath(`${stage}.png`), fullPage: true });
    });
  }

  test("a driver chooses a quote, confirms, and the page moves to tracking", async ({ page }) => {
    const token = tokenAt("quoting", 40);
    test.skip(!token, "No demo request taking quotes right now");
    await page.goto(url(`/r/${token}`));
    await page.getByRole("button", { name: "Cheapest" }).click();
    await page.getByRole("button", { name: "Choose" }).first().click();
    await expect(
      page.getByText("You pay the provider directly when the job is done."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm and request" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Provider confirmed|On the way/,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("img", { name: /provider on the way/i })).toBeVisible();
  });

  test("cancel with a reason, and an unknown token gets a friendly page", async ({ page }) => {
    const token = tokenAt("searching", 20) ?? tokenAt("quoting", 20);
    test.skip(!token, "No early-stage demo request right now");
    await page.goto(url(`/r/${token}`));
    await page.getByRole("button", { name: "Cancel request" }).click();
    await page.getByRole("radio", { name: "The problem is fixed" }).check();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel request" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Request cancelled/);
    await page.goto(url("/r/not-a-real-token-at-all"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/couldn't find that request/);
  });
});
