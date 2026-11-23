import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { nextConfig } from "../eslint/next.mjs";

async function lint(code: string, filePath = "src/app/page.tsx") {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: nextConfig });
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.map((m) => m.ruleId);
}

describe("no hardcoded user-facing text (RSOS-015)", () => {
  it("rejects JSX text", async () => {
    expect(await lint("export function P() { return <p>Get help now</p>; }")).toContain(
      "react/jsx-no-literals",
    );
  });

  it("rejects literal aria-label, placeholder, alt and title", async () => {
    const rules = await lint(
      'export function P() { return <input aria-label="Phone" placeholder="Your phone" />; }',
    );
    expect(rules.filter((r) => r === "no-restricted-syntax")).toHaveLength(2);
  });

  it("allows translated text, class names and punctuation", async () => {
    const rules = await lint(
      'export function P({ t }: { t: (k: string) => string }) { return <p className="text-lg">{t("cta")} ·</p>; }',
    );
    expect(rules).not.toContain("react/jsx-no-literals");
    expect(rules).not.toContain("no-restricted-syntax");
  });

  it("does not apply to stories and tests", async () => {
    expect(
      await lint("export const S = () => <p>Demo text</p>;", "src/stories/demo.stories.tsx"),
    ).not.toContain("react/jsx-no-literals");
  });
});
