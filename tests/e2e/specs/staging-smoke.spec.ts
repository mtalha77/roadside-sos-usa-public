import { answerScreenOne } from "../support/get-help";
import { appUrls, expect, test } from "../support/fixtures";

// RSOS-099 staging smoke (runs after every staging deploy, and in Release QA): all three health
// checks are green on the expected commit, and the Get Help flow reaches the quotes screen in demo
// mode. Demo sign-in for every role is in demo-sign-in.spec.ts. Tagged @staging.

const expectedSha = process.env.EXPECTED_SHA;

test.describe("staging smoke @staging", () => {
  for (const app of ["web", "provider", "admin"] as const) {
    test(`${app} health is green @staging`, async ({ request }) => {
      const base = appUrls[app];
      test.skip(!base, `No ${app} URL`);
      const res = await request.get(new URL("/api/health", base).toString());
      const body = (await res.json()) as {
        ok: boolean;
        app: string;
        commit: string | null;
        database: string;
        serviceKey: string;
        adapters: Record<string, string>;
      };
      expect(body.app).toBe(app);
      expect(body.database).toBe("ok");
      expect(body.serviceKey).not.toBe("mismatch");
      expect(body.ok).toBe(true);
      expect(res.status()).toBe(200);
      for (const state of Object.values(body.adapters))
        expect(["real", "fake", "deferred"]).toContain(state);
      if (expectedSha) expect(body.commit).toBe(expectedSha);
    });
  }

  test("Get Help reaches the quotes screen in demo mode @staging", async ({ page }, info) => {
    const web = appUrls.web;
    test.skip(!web, "No website URL");
    test.skip(info.project.name !== "desktop-chrome", "One browser is enough for this smoke flow");
    test.setTimeout(150_000);
    const url = (p: string) => new URL(p, web).toString();
    // Three screens (RSOS-101): what happened, where, who and which vehicle.
    await page.goto(url("/get-help"));
    await page.getByRole("link", { name: "Flat tire" }).click();
    await answerScreenOne(page, "flat-tire");
    await page.getByLabel("Street address or cross streets").fill("1200 Main St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Who should the provider look for?" }),
    ).toBeVisible();
    // The name the staging "no fake data" check expects; a fictional 555-01xx number.
    await page.getByLabel("Your name").fill("Smoke Test Driver");
    await page
      .getByLabel("Mobile number")
      .fill(`(210) 555-01${String(Math.floor(Math.random() * 90) + 10)}`);
    await page.getByLabel("Make").fill("Toyota");
    await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{20,}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Quotes are coming in/, {
      timeout: 90_000,
    });
  });
});
