import { signInAsDemo } from "../support/demo";
import {
  appUrls,
  expect,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  test,
} from "../support/fixtures";

// Part B: provider portal, signed in as the demo company (previews use rsos-dev).
const base = appUrls.provider;
const url = (p: string) => new URL(p, base).toString();

test.describe("provider portal shell", () => {
  test.skip(!base, "No provider URL");

  test("installable app with tabs, more menu and install guide", async ({
    page,
    request,
  }, info) => {
    test.setTimeout(90_000);
    await signInAsDemo(page, base!, "Provider owner");
    await expect(page.getByRole("navigation", { name: "Portal" }).first()).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("portal-home.png"), fullPage: true });
    await page.goto(url("/more"));
    await expect(page.getByRole("link", { name: "Install the app" })).toBeVisible();
    await page.goto(url("/install"));
    await expect(page.getByRole("heading", { name: "iPhone (Safari)" })).toBeVisible();
    const manifest = await (await request.get(url("/manifest.webmanifest"))).json();
    expect(manifest.display).toBe("standalone");
    expect((await request.get(url("/offline.html"))).status()).toBe(200);
  });
});
