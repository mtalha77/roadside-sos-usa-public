/**
 * Finds hardcoded brand names or domains outside the places allowed to contain them.
 * Used by `node scripts/check-brand.ts` in CI.
 */
export const BRAND_PATTERN = /roadside[\s_-]*sos|fixallcontractors/i;

/** Paths allowed to contain the brand name or domain. */
export function isAllowedPath(path: string): boolean {
  return (
    path.startsWith("packages/config/") || // the brand config itself
    /(^|\/)\.env[^/]*$/.test(path) || // environment files
    path.endsWith(".md") || // documentation and run reports describe the working name
    path === "scripts/check-brand.ts" ||
    path === "pnpm-lock.yaml"
  );
}

export type Violation = { path: string; line: number; text: string };

export function findBrandViolations(files: { path: string; content: string }[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    if (isAllowedPath(file.path)) continue;
    file.content.split("\n").forEach((text, index) => {
      if (BRAND_PATTERN.test(text))
        violations.push({ path: file.path, line: index + 1, text: text.trim() });
    });
  }
  return violations;
}
