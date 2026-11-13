import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, openStory } from "./helpers";

type Index = { entries: Record<string, { id: string; type: string; title: string; name: string }> };
const indexPath = fileURLToPath(
  new URL("../../../packages/ui/storybook-static/index.json", import.meta.url),
);
const stories = Object.values(
  (JSON.parse(readFileSync(indexPath, "utf8")) as Index).entries,
).filter((e) => e.type === "story");

for (const story of stories) {
  for (const theme of ["light", "dark"] as const) {
    test(`${story.title} / ${story.name} (${theme}): axe clean, no console errors`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      await openStory(page, story.id, theme);
      await expectNoA11yViolations(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow, "horizontal scroll").toBe(false);
      expect(errors).toEqual([]);
    });
  }
}
