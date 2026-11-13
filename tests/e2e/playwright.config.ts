import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against deployed apps (Vercel previews in CI, staging in Release QA).
 * Set E2E_WEB_URL, E2E_PROVIDER_URL and E2E_ADMIN_URL; specs for an app without a URL skip.
 * VERCEL_AUTOMATION_BYPASS_SECRET opens protected previews (provider, admin).
 */
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  // Tests mostly wait on the network (previews, static server), so run more at once than CPU count.
  workers: process.env.CI ? 4 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 45_000,
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      "x-vercel-skip-toolbar": "1",
      ...(bypass
        ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }
        : {}),
    },
  },
  projects: [
    { name: "mobile-safari", use: { ...devices["iPhone 15"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
