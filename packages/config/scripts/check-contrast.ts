// Checks every token colour pair against WCAG 2.2 AA in both themes. Exits 1 on any failure.
import { contrastRatio } from "../src/color.ts";
import { contrastPairs, themes } from "../src/tokens.ts";

let failures = 0;
for (const [name, tokens] of Object.entries(themes)) {
  for (const { fg, bg, min } of contrastPairs) {
    const a = tokens[fg];
    const b = tokens[bg];
    if (!a || !b) {
      console.error(`${name}: missing token ${!a ? fg : bg}`);
      failures++;
      continue;
    }
    const ratio = contrastRatio(a, b);
    const ok = ratio >= min;
    if (!ok) failures++;
    console.log(
      `${ok ? "pass" : "FAIL"}  ${name.padEnd(5)}  ${fg} on ${bg}`.padEnd(64) +
        `${ratio.toFixed(2)}:1 (min ${min})`,
    );
  }
}
if (failures) {
  console.error(`${failures} colour pair(s) fail WCAG 2.2 AA.`);
  process.exit(1);
}
console.log("All colour pairs meet WCAG 2.2 AA in light and dark.");
