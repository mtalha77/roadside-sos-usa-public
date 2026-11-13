import { brand } from "@rsos/config/brand";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
  type AppName,
} from "../support/fixtures";

for (const app of Object.keys(appUrls) as AppName[]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${app} home renders, is accessible and error-free (${colorScheme})`, async ({ page }) => {
      const url = appUrls[app];
      test.skip(!url, `No URL for ${app} (not deployed in this run)`);
      await page.emulateMedia({ colorScheme });
      const response = await page.goto(url!, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(brand.name);
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page);
    });
  }

  test(`${app} health endpoint responds`, async ({ request }) => {
    const url = appUrls[app];
    test.skip(!url, `No URL for ${app}`);
    const res = await request.get(new URL("/api/health", url).toString());
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });
}

// Production smoke (Gate 4): `pnpm test:smoke` runs only @smoke tests.
test("@smoke website home and health are up", async ({ page, request }) => {
  const url = appUrls.web;
  test.skip(!url, "No website URL");
  const res = await page.goto(url!);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(brand.name);
  expect((await request.get(new URL("/api/health", url).toString())).status()).toBe(200);
});

// Alert drill: SMOKE_SIMULATE_FAILURE=1 makes this fail on purpose without touching any data.
test("@smoke alert drill", async () => {
  test.skip(process.env.SMOKE_SIMULATE_FAILURE !== "1", "Only runs in an alert drill");
  expect(false, "Simulated production smoke failure (RSOS-096 alert drill)").toBe(true);
});
