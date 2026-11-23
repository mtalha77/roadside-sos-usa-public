import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every colour in UI code must be a design token so switching theme changes every surface.
 * Blocks raw colour literals and Tailwind palette classes in apps and packages/ui.
 */
const ROOT = join(__dirname, "../../..");
const DIRS = ["apps/web/src", "apps/provider/src", "apps/admin/src", "packages/ui/src"];
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/;
const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|shadow|accent|caret)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe("no hardcoded colours", () => {
  it("uses only design tokens in app and UI code", () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const path of files(join(ROOT, dir))) {
        readFileSync(path, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (LITERAL.test(line) || PALETTE.test(line))
              offenders.push(`${relative(ROOT, path)}:${i + 1}  ${line.trim()}`);
          });
      }
    }
    expect(offenders).toEqual([]);
  });
});
