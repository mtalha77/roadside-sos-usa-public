import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, openStory } from "./helpers";

test.describe("Sheet", () => {
  test("opens, traps focus, closes with Escape", async ({ page }) => {
    await openStory(page, "components-overlays--sheet-bottom");
    const trigger = page.getByRole("button", { name: "Choose a service" });
    await trigger.click();
    const sheet = page.getByRole("dialog", { name: "What do you need?" });
    await expect(sheet).toBeVisible();
    await expectNoA11yViolations(page);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("closes when swiped down", async ({ page }) => {
    await openStory(page, "components-overlays--sheet-bottom");
    await page.getByRole("button", { name: "Choose a service" }).click();
    const sheet = page.getByRole("dialog", { name: "What do you need?" });
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(700); // vaul ignores drags during the opening animation
    const box = (await sheet.boundingBox())!;
    const x = box.x + box.width / 2;
    const startY = box.y + 40;
    await page.mouse.move(x, startY);
    await page.mouse.down();
    for (let dy = 20; dy <= 360; dy += 20) await page.mouse.move(x, startY + dy, { steps: 2 });
    await page.mouse.up();
    await expect(sheet).toBeHidden();
  });
});

test("Dialog traps focus and closes with Escape", async ({ page }) => {
  await openStory(page, "components-overlays--dialog-modal");
  const trigger = page.getByRole("button", { name: "Cancel request" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Cancel this request?" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Drawer closes with Escape", async ({ page }) => {
  await openStory(page, "components-overlays--drawer-panel");
  await page.getByRole("button", { name: "Open request R-7KQ2" }).click();
  const drawer = page.getByRole("dialog", { name: "Request R-7KQ2" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});

test("DataTable scrolls 10,000 rows smoothly", async ({ page }) => {
  await openStory(page, "components-data--ten-thousand-rows");
  const region = page.getByRole("region", { name: "All requests" });
  await expect(region).toBeVisible();
  await expect(page.getByRole("table")).toHaveAttribute("aria-rowcount", "10001");
  const result = await region.evaluate(async (el) => {
    const frames: number[] = [];
    let last = performance.now();
    let running = true;
    const tick = (t: number) => {
      frames.push(t - last);
      last = t;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const max = el.scrollHeight - el.clientHeight;
    for (let i = 1; i <= 60; i++) {
      el.scrollTop = (max * i) / 60;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    running = false;
    const sorted = [...frames].sort((a, b) => a - b);
    return {
      rowsInDom: el.querySelectorAll("tbody tr[aria-rowindex]").length,
      lastIndex: Number(
        el.querySelector("tbody tr[aria-rowindex]:last-of-type")?.getAttribute("aria-rowindex"),
      ),
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    };
  });
  expect(result.rowsInDom).toBeLessThan(80);
  expect(result.lastIndex).toBe(10001);
  // 95% of frames under 50 ms while jumping through the whole list (CI machines are slow; 60 fps is ~17 ms).
  expect(result.p95).toBeLessThan(50);
});
