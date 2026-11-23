import { describe, expect, it } from "vitest";
import { contrastRatio, parseOklch, toHex } from "../src/color";
import { themeColor } from "../src/theme-colors";
import { contrastPairs, themes } from "../src/tokens";

describe("colour math", () => {
  it("matches known reference values", () => {
    expect(toHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(toHex("oklch(0 0 0)")).toBe("#000000");
    expect(contrastRatio("oklch(1 0 0)", "oklch(0 0 0)")).toBeCloseTo(21, 1);
    expect(parseOklch("oklch(50% 0.1 200)")).toMatchObject({ l: 0.5, c: 0.1, h: 200 });
    expect(() => parseOklch("#fff")).toThrow();
  });
});

describe("design tokens", () => {
  it.each(Object.entries(themes))("every colour pair meets WCAG 2.2 AA in %s", (_name, tokens) => {
    for (const { fg, bg, min } of contrastPairs) {
      expect(contrastRatio(tokens[fg]!, tokens[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
    }
  });

  it("light and dark define the same tokens", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it("exports hex theme colours for the browser chrome", () => {
    expect(themeColor.light).toMatch(/^#[0-9a-f]{6}$/);
    expect(themeColor.dark).not.toBe(themeColor.light);
  });
});
