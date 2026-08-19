import { expect, test } from "@playwright/test";

test("appearance changes immediately and survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "表示設定" }).click();
  await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();

  await page.getByRole("radio", { name: /テーマ：\s*クラシック/ }).check();
  await page.getByRole("radio", { name: /表示密度：\s*コンパクト/ }).check();
  await page.getByLabel("モーション").selectOption("reduced");

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "classic");
  await expect(root).toHaveAttribute("data-density", "compact");
  await expect(root).toHaveAttribute("data-motion", "reduced");

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "classic");
  await expect(root).toHaveAttribute("data-density", "compact");
  await expect(root).toHaveAttribute("data-motion", "reduced");
});

test("appearance settings remain usable on a phone viewport", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "表示設定" }).click();

  const controls = page.locator(
    ".settings-option, .settings-group--inline label, .settings-select select, .settings-shell button",
  );
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    expect(box, "settings control must have a rendered box").not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
  await context.close();
});
