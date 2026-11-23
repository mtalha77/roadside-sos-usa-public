import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export function storyUrl(id: string, theme: "light" | "dark" = "light") {
  return `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`;
}

export async function openStory(page: Page, id: string, theme: "light" | "dark" = "light") {
  await page.goto(storyUrl(id, theme));
  await expect(page.locator("#storybook-root > *").first()).toBeVisible();
  if (theme === "dark") await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  else await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
}

export async function expectNoA11yViolations(page: Page) {
  const run = () =>
    new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      // Radix focus guards are invisible parts of the focus trap, not content.
      .exclude("[data-radix-focus-guard]")
      .analyze();
  // Storybook's a11y panel runs axe in the same frame; wait for it to finish instead of colliding.
  let results: Awaited<ReturnType<typeof run>> | undefined;
  for (let attempt = 0; !results; attempt++) {
    try {
      results = await run();
    } catch (error) {
      if (attempt >= 10 || !String(error).includes("already running")) throw error;
      await page.waitForTimeout(300);
    }
  }
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}
