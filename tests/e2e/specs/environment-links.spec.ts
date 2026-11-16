import { productionHosts } from "@rsos/config/site";
import type { Page } from "@playwright/test";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, test } from "../support/fixtures";

// Outside production, no page may link to a production host: every link between apps
// (walkthrough, Run full demo, notifications, status pages, footers) must stay in the current
// environment. Collects every absolute link and form target on the pages that build them.

const PROD = new Set(productionHosts());
const isProductionRun = (base: string) => PROD.has(new URL(base).host);

async function productionLinks(page: Page): Promise<string[]> {
  const urls = await page.evaluate(() =>
    [
      ...[...document.querySelectorAll("a[href]")].map((a) => (a as HTMLAnchorElement).href),
      ...[...document.querySelectorAll("form[action]")].map((f) => (f as HTMLFormElement).action),
    ].filter((u) => /^https?:/.test(u)),
  );
  return [...new Set(urls)].filter((u) => PROD.has(new URL(u).host));
}

test.describe("links stay in the current environment", () => {
  test("website pages", async ({ page }) => {
    const base = appUrls.web;
    test.skip(!base || isProductionRun(base), "Production run or no website URL");
    for (const path of ["/", "/get-help", "/for-providers", "/lp/houston/tow"]) {
      await page.goto(new URL(path, base).toString());
      expect(await productionLinks(page), `production links on ${path}`).toEqual([]);
    }
  });

  test("provider portal", async ({ page }) => {
    const base = appUrls.provider;
    test.skip(!base || isProductionRun(base), "Production run or no provider URL");
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    for (const path of ["/", "/more", "/notifications", "/help"]) {
      await page.goto(new URL(path, base).toString());
      expect(await productionLinks(page), `production links on ${path}`).toEqual([]);
    }
  });

  test("admin walkthrough, demo controls and status links", async ({ page }) => {
    const base = appUrls.admin;
    test.skip(!base || isProductionRun(base), "Production run or no admin URL");
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Super admin");
    for (const path of ["/walkthrough", "/dispatch", "/requests", "/settings?tab=integrations"]) {
      await page.goto(new URL(path, base).toString());
      expect(await productionLinks(page), `production links on ${path}`).toEqual([]);
    }
    // The walkthrough's driver links point at this environment's website.
    await page.goto(new URL("/walkthrough", base).toString());
    const driver = await page
      .getByRole("link", { name: "Open the driver's view" })
      .getAttribute("href");
    expect(PROD.has(new URL(driver!).host)).toBe(false);
  });
});
