import { defineConfig, devices } from "@playwright/test";

/**
 * Component checks in a real browser against the built Storybook (packages/ui/storybook-static):
 * axe and console errors on every story, and overlay/table behaviour jsdom cannot simulate.
 * Run `pnpm --filter @rsos/ui build-storybook` first.
 */
const PORT = 6106;
export default defineConfig({
  testDir: "./storybook",
  fullyParallel: true,
  // Default workers: the scrolling-smoothness check needs CPU to itself.
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-storybook" }]]
    : "list",
  // Reduced motion makes theme switches instant, so axe never samples a colour mid-transition.
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure", reducedMotion: "reduce" },
  webServer: {
    command: `node scripts/serve-static.ts ../../packages/ui/storybook-static ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore",
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
