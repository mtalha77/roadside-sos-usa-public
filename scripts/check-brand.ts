// Fails if the brand name or domain is hardcoded outside packages/config and env files.
// Run with: node scripts/check-brand.ts   (Node 26 runs TypeScript directly)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { findBrandViolations } from "../packages/config/src/brand-guard.ts";

const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const files = paths
  .filter((path) => existsSync(path) && !/\.(png|jpe?g|gif|webp|ico|woff2?|pdf)$/i.test(path))
  .map((path) => ({ path, content: readFileSync(path, "utf8") }));

const violations = findBrandViolations(files);
if (violations.length > 0) {
  console.error(
    "Hardcoded brand name or domain found. Import `brand` from @rsos/config/brand instead:",
  );
  for (const v of violations) console.error(`  ${v.path}:${v.line}  ${v.text}`);
  process.exit(1);
}
console.log(`Brand check passed (${files.length} files).`);
