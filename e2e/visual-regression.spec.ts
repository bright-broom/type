import { expect, test, type Page } from "@playwright/test";

const LAPTOP_VIEWPORT = { width: 1280, height: 720 };
const SCREENSHOT_OPTIONS = {
  animations: "disabled" as const,
  caret: "hide" as const,
  fullPage: true,
  maxDiffPixelRatio: 0.01,
  threshold: 0.2,
};

async function finishTypingSession(page: Page) {
  await page.clock.install({ time: new Date("2026-08-21T12:00:00+09:00") });
  await page.goto("/");
  await page.getByRole("button", { name: /60秒練習する/ }).click();
  await page.clock.fastForward(65_000);
  await expect(page.getByRole("heading", { name: "おつかれさまでした。" })).toBeVisible();
}

test.describe("noir visual baselines", () => {
  test.use({ viewport: LAPTOP_VIEWPORT });
  test.skip(({ browserName }) => browserName !== "chromium", "One rendering engine owns the pixel baseline.");

  test("home", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("home-noir.png", SCREENSHOT_OPTIONS);
  });

  test("appearance settings", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "表示設定" }).click();
    await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();
    await expect(page).toHaveScreenshot("settings-noir.png", SCREENSHOT_OPTIONS);
  });

  test("takken practice launcher", async ({ page }) => {
    await page.goto("/takken/practice");
    await expect(page.getByRole("heading", { name: /理解を確かめる/ })).toBeVisible();
    await expect(page).toHaveScreenshot("takken-practice-noir.png", SCREENSHOT_OPTIONS);
  });

  test("typing result", async ({ page }) => {
    await finishTypingSession(page);
    await expect(page).toHaveScreenshot("result-noir.png", SCREENSHOT_OPTIONS);
  });
});
