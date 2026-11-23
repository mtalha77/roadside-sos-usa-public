// Runs Lighthouse CI (mobile) with the budgets in lighthouserc.json (RSOS-033).
// Usage: LIGHTHOUSE_URLS="https://site" node scripts/lighthouse.ts
// For each website URL it checks the home page, a city page, a service page and /get-help. City and
// service pages are found in the site's own sitemaps, so no city is hardcoded here.
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const bases = (process.env.LIGHTHOUSE_URLS ?? "").split(/\s+/).filter(Boolean);
if (bases.length === 0) {
  console.log("No URLs to check (no preview deployed for the website). Skipping Lighthouse.");
  process.exit(0);
}

async function firstLoc(base: string, sitemap: string): Promise<string | null> {
  const res = await fetch(new URL(`/sitemaps/${sitemap}.xml`, base));
  if (!res.ok) return null;
  const loc = /<loc>([^<]+)<\/loc>/.exec(await res.text())?.[1];
  return loc ? new URL(new URL(loc).pathname, base).toString() : null;
}

const urls: string[] = [];
for (const base of bases) {
  const root = new URL("/", base).toString();
  const city = await firstLoc(root, "cities");
  const service = await firstLoc(root, "services");
  // An ad landing page for the first city and service (RSOS-029; not in the sitemaps: noindex).
  const slug = (u: string | null) => (u ? new URL(u).pathname.split("/").pop() : null);
  const lp =
    city && service ? new URL(`/lp/${slug(city)}/${slug(service)}`, root).toString() : null;
  urls.push(
    root,
    ...(city ? [city] : []),
    ...(service ? [service] : []),
    new URL("/get-help", root).toString(),
    ...(lp ? [lp] : []),
  );
}
console.log(`Lighthouse pages:\n${urls.join("\n")}`);

const env = { ...process.env, CHROME_PATH: chromium.executablePath() };
execFileSync(
  "pnpm",
  [
    "exec",
    "lhci",
    "autorun",
    "--config=lighthouserc.json",
    ...urls.map((u) => `--collect.url=${u}`),
  ],
  {
    stdio: "inherit",
    env,
  },
);
