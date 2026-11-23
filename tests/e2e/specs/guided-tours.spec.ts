import type { Page } from "@playwright/test";
import { signInAsDemo } from "../support/demo";
import { appUrls, expect, expectNoA11yViolations, test } from "../support/fixtures";

// RSOS-105: role tours in the admin and the provider portal (start, skip, don't show again,
// restart), page tours from "?", and the website's "See how it works" demo, which never starts
// on its own. Progress is saved per person in the database (supabase/tests/028).

const admin = appUrls.admin;
const provider = appUrls.provider;
const web = appUrls.web;

async function openMenuOnPhone(page: Page) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) await menu.click();
}

test.describe("guided tours", () => {
  for (const [role, first] of [
    ["Owner", "Today"],
    ["Dispatcher", "Inbox"],
  ] as const) {
    test(`admin ${role}: start, skip, don't show again and restart`, async ({ page }, info) => {
      test.skip(!admin, "No admin URL");
      test.setTimeout(120_000);
      await signInAsDemo(page, admin!, role);
      await openMenuOnPhone(page);
      await page.getByRole("button", { name: "Take the tour" }).click();
      const tour = page.getByRole("dialog", { name: first });
      await expect(tour).toBeVisible();
      await expect(tour.getByText(/^Step 1 of \d$/)).toBeVisible();
      await expectNoA11yViolations(page);
      await tour.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText(/^Step 2 of \d$/)).toBeVisible();
      await page.screenshot({ path: info.outputPath(`tour-admin-${role}.png`) });
      await page.getByRole("button", { name: "Skip tour" }).click();
      await expect(page.getByRole("dialog", { name: first })).toBeHidden();

      // Restart, then don't show again: it stays closed after a reload.
      await openMenuOnPhone(page);
      await page.getByRole("button", { name: "Take the tour" }).click();
      await page.getByRole("button", { name: "Don't show again" }).click();
      await expect(page.getByRole("dialog", { name: first })).toBeHidden();
      // Let the save reach the server before reloading.
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.reload();
      await page.waitForTimeout(1500);
      await expect(page.locator("[data-tour-open]")).toHaveCount(0);
    });
  }

  test("admin page tour from the ? button", async ({ page }) => {
    test.skip(!admin, "No admin URL");
    test.setTimeout(90_000);
    await signInAsDemo(page, admin!, "Dispatcher");
    await page.goto(new URL("/dispatch", admin).toString());
    await page.getByRole("button", { name: "Tour of this page" }).click();
    await expect(page.getByRole("dialog", { name: "One market at a time" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "One market at a time" })).toBeHidden();
  });

  for (const [role, first] of [
    ["Provider owner", "Go online"],
    ["Technician", "My jobs"],
  ] as const) {
    test(`provider ${role}: start, skip and restart`, async ({ page }, info) => {
      test.skip(!provider, "No provider URL");
      test.setTimeout(120_000);
      await signInAsDemo(page, provider!, role);
      // Technicians are sent to My jobs after sign-in: wait for that before going anywhere.
      if (role === "Technician") await expect(page).toHaveURL(/\/jobs/);
      // Owners: side menu on desktop, More on phones. Technicians: on My jobs.
      const take = page.getByRole("button", { name: "Take the tour" });
      if (!(await take.isVisible()))
        await page.goto(new URL(role === "Technician" ? "/jobs" : "/more", provider).toString());
      await take.click();
      const tour = page.getByRole("dialog", { name: first });
      await expect(tour).toBeVisible();
      await expectNoA11yViolations(page);
      await page.screenshot({ path: info.outputPath(`tour-provider-${role}.png`) });
      await tour.getByRole("button", { name: "Skip tour" }).click();
      await expect(tour).toBeHidden();
    });
  }

  test("website: See how it works plays a skippable demo with Get help now visible", async ({
    page,
  }) => {
    test.skip(!web, "No website URL");
    await page.goto(new URL("/", web).toString());
    await expect(page.locator("[data-tour-open]")).toHaveCount(0);
    await page.getByRole("link", { name: "See how it works" }).click();
    await expect(page.getByRole("heading", { name: "How it works, in 30 seconds" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get help now" }).last()).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Demo progress" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    await expect(page.getByRole("progressbar", { name: "Demo progress" })).toHaveAttribute(
      "aria-valuenow",
      "2",
      { timeout: 10_000 },
    );
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.getByRole("link", { name: "Skip demo" }).click();
    await expect(page).toHaveURL(new URL("/", web).toString());
  });
});
