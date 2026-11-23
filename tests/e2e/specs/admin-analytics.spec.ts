import type { Page } from "@playwright/test";
import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// RSOS-081, rebuilt in RSOS-113: Real (default), Demo and Model views never mixed; the funnel
// never shows a step above 100%; the Economics model drives the Model view.
const base = appUrls.admin;
const url = (p: string) => new URL(p, base).toString();

async function percentsAtMost100(page: Page) {
  const text = (await page.getByRole("region", { name: /^Funnel(?! by)/ }).innerText()) ?? "";
  const values = [...text.matchAll(/·\s*([\d.,]+)%/g)].map((m) => Number(m[1]!.replace(",", "")));
  for (const v of values) expect(v, "a funnel step above 100%").toBeLessThanOrEqual(100);
}

test.describe("admin analytics", () => {
  test.skip(!base, "No admin URL");

  test("Real by default; Demo and Model are labelled and never mixed", async ({ page }, info) => {
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Owner");
    await page.goto(url("/analytics"));
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Real", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // (The site-wide demo strip says "Demo data" too: look only at the page itself.)
    const main = page.getByRole("main");
    await expect(main.getByText("Demo data", { exact: true })).toHaveCount(0);
    await expect(main.getByText("Model estimate", { exact: true })).toHaveCount(0);
    await percentsAtMost100(page);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("analytics-real.png"), fullPage: true });

    await page.getByRole("link", { name: "Model", exact: true }).click();
    await expect(main.getByText("Model estimate", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Last 30 days" }).click();
    await expect(page.getByRole("link", { name: "Last 30 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await percentsAtMost100(page);
    // Sources and channels each add up to the requests.
    for (const name of ["Requests by source", "Requests by channel"])
      await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.getByRole("link", { name: "Demo", exact: true }).click();
    await expect(main.getByText("Demo data", { exact: true }).first()).toBeVisible();
    await expect(main.getByText("Model estimate", { exact: true })).toHaveCount(0);
    await percentsAtMost100(page);
    await expectNoA11yViolations(page);
  });

  test("changing a cost per click updates the Model view at once", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-chrome", "One browser edits the shared model");
    test.setTimeout(120_000);
    await signInAsDemo(page, base!, "Owner");
    await page.goto(url("/economics"));
    await expect(page.getByRole("heading", { name: "Economics model", level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    const form = page.locator("details[open] form").first();
    const cpc = form.getByLabel(/^Cost per click/);
    const original = await cpc.inputValue();
    const market = await page.locator("main section h2").nth(1).innerText();
    const marketSlugLink = page.getByRole("link", { name: market, exact: true });
    const modelCost = async () => {
      await page.goto(url("/analytics?view=model&days=30"));
      await marketSlugLink.click();
      return page
        .locator("dl > div", { hasText: "Ad cost per accepted request" })
        .locator("dd")
        .first()
        .innerText();
    };
    const before = await modelCost();
    try {
      await page.goto(url("/economics"));
      await cpc.fill(String(Number(original) * 2));
      await form.getByRole("button", { name: "Save" }).click();
      await expect(form.getByText(/^Saved\./)).toBeVisible();
      expect(await modelCost()).not.toBe(before);
    } finally {
      await page.goto(url("/economics"));
      await cpc.fill(original);
      await form.getByRole("button", { name: "Save" }).click();
      await expect(form.getByText(/^Saved\./)).toBeVisible();
    }
    expect(await modelCost()).toBe(before);
  });
});
