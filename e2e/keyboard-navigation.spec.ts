import { expect, test } from "@playwright/test";

const dictionaries = [/コンサル実務辞典を開く/, /宅建試験 完全用語一覧を開く/] as const;

test("dictionary Escape and Enter shortcuts match the visible navigation", async ({ page }) => {
  await page.clock.install();
  for (const dictionary of dictionaries) {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: dictionary });
    await trigger.click();
    const overlay = page.locator("[data-overlay-root]");
    await expect(overlay).toBeFocused();
    const search = page.getByRole("searchbox");
    await search.fill("MECE");
    await search.press("Escape");
    // Native search-field Escape behavior differs by engine; the app must not intercept it.
    await expect(overlay).toBeVisible();
    await page.getByRole("button", { name: /ホームへ/ }).focus();
    await page.keyboard.press("Escape");
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.matches("[data-focus-key], [data-home-root]")))
      .toBe(true);

    await trigger.click();
    await page.keyboard.press("Enter");
    await page.clock.fastForward(4_000);
    await expect(page.getByRole("button", { name: /一時停止/ })).toBeVisible();
  }
});

test("focus stays natural on first load and returns to the result surface", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("body")).toBeFocused();
  await page.getByRole("button", { name: /60秒練習する/ }).click();
  await page.clock.fastForward(65_000);
  await expect(page.locator("[data-result-root]")).toBeFocused();

  await page.getByRole("button", { name: /練習履歴/ }).click();
  await expect(page.locator("[data-overlay-root]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.matches('[data-focus-key="result-history"], [data-result-root]')),
    )
    .toBe(true);
});
