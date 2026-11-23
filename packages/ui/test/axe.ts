import axe from "axe-core";
import { expect } from "vitest";

/** Fails on serious or critical axe violations (WCAG 2.2 AA). Colour contrast is checked by tokens:check (jsdom has no layout). */
export async function expectNoAxeViolations(root: Element = document.body) {
  // Radix focus guards (invisible, aria-hidden spans that bounce focus back into an open dialog)
  // are part of the focus trap, not content; axe cannot tell, so they are excluded.
  const results = await axe.run(
    { include: [root], exclude: [["[data-radix-focus-guard]"]] } as unknown as Element,
    {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    },
  );
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}
