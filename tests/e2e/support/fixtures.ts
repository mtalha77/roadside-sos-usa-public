import AxeBuilder from "@axe-core/playwright";
import { legalDocuments } from "@rsos/config/legal";
import { expect, test as base, type Page } from "@playwright/test";

export type AppName = "web" | "provider" | "admin";

/** True when the target uses a real database (release checks against staging): tests that write skip. */
export const readOnly = process.env.E2E_READ_ONLY === "1";

export const appUrls: Record<AppName, string | undefined> = {
  web: process.env.E2E_WEB_URL,
  provider: process.env.E2E_PROVIDER_URL,
  admin: process.env.E2E_ADMIN_URL,
};

/**
 * `test` with an automatic console guard: any console error or uncaught page error fails
 * the test. Third-party noise must be fixed at the source, not filtered here.
 */
export const test = base.extend<{
  consoleErrors: string[];
  presetConsent: boolean;
  consentCookie: void;
}>({
  /** Set false in a test to see the cookie banner (RSOS-028 consent tests). */
  presetConsent: [true, { option: true }],
  // Most tests start with cookie choices already made (all rejected) so the banner does not cover
  // the page; the consent tests turn this off.
  consentCookie: [
    async ({ context, presetConsent }, use) => {
      if (presetConsent && appUrls.web) {
        const value = encodeURIComponent(
          JSON.stringify({ v: legalDocuments.cookies.version, a: false, d: false, gpc: false }),
        );
        await context.addCookies([
          { name: "rsos_consent", value, url: new URL(appUrls.web).origin },
        ]);
      }
      await use();
    },
    { auto: true },
  ],
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
      });
      page.on("pageerror", (err) => {
        // WebKit reports a Next.js link prefetch (`_rsc=` request) that a navigation cancelled as
        // "due to access control checks". It is not an app error; anything else still fails.
        if (/[?&]_rsc=\S* due to access control checks\.$/.test(err.message)) return;
        errors.push(`pageerror: ${err.message}`);
      });
      await use(errors);
      expect(errors, "browser console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Fails on any serious or critical axe violation (WCAG 2.2 AA rule set). */
export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    blocking.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    ),
    "axe serious/critical violations",
  ).toEqual([]);
}

/** No sideways scrolling at the current viewport. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal scroll").toBe(false);
}
