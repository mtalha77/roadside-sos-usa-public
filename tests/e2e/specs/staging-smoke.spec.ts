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
      for (const state of Object.values(body.adapters)) expect(["real", "fake"]).toContain(state);
      if (expectedSha) expect(body.commit).toBe(expectedSha);
    });
  }

  test("Get Help reaches the quotes screen in demo mode @staging", async ({ page }, info) => {
    const web = appUrls.web;
    test.skip(!web, "No website URL");
    test.skip(info.project.name !== "desktop-chrome", "One browser is enough for this smoke flow");
    test.setTimeout(150_000);
    const url = (p: string) => new URL(p, web).toString();
    await page.goto(url("/get-help"));
    await page.getByLabel("Street address or cross streets").fill("1200 Main St");
    await page.getByLabel("City").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What happened?" })).toBeVisible();
    await page.locator("label").filter({ hasText: "Flat tire" }).click();
    await page.getByRole("radio", { name: "Yes" }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What are you driving?" })).toBeVisible();
    await page.getByLabel("Make").fill("Toyota");
    await page.getByLabel("Model").fill("Camry");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Are you safe?" })).toBeVisible();
    await page
      .getByRole("group", { name: /safe place/ })
      .getByRole("radio", { name: "Yes" })
      .check();
    await page
      .getByRole("group", { name: /highway/ })
      .getByRole("radio", { name: "No" })
      .check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: /reach you/ })).toBeVisible();
    await page.getByLabel("Your name").fill("Smoke Test Driver");
    // Fictional 555-01xx number: never a real phone (demo mode shows the code on screen).
    await page
      .getByLabel("Mobile number")
      .fill(`(210) 555-01${String(Math.floor(Math.random() * 90) + 10)}`);
    await page.getByRole("button", { name: "Text me a code" }).click();
    await expect(page.getByRole("heading", { name: "Enter the 6-digit code" })).toBeVisible();
    const code = /code is (\d{6})/.exec(
      (await page.getByText(/Your code is/).textContent()) ?? "",
    )?.[1];
    await page.getByLabel("Code").fill(code!);
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
