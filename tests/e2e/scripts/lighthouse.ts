// Runs Lighthouse CI (mobile) with the budgets in lighthouserc.json against the given URLs.
// Usage: LIGHTHOUSE_URLS="https://a https://b" node scripts/lighthouse.ts
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const urls = (process.env.LIGHTHOUSE_URLS ?? "").split(/\s+/).filter(Boolean);
if (urls.length === 0) {
  console.log("No URLs to check (no preview deployed for the website). Skipping Lighthouse.");
  process.exit(0);
}

const env = { ...process.env, CHROME_PATH: chromium.executablePath() };
const args = [
  "lhci",
  "autorun",
  "--config=lighthouserc.json",
  ...urls.map((u) => `--collect.url=${u}`),
];
execFileSync("pnpm", ["exec", ...args], { stdio: "inherit", env });
