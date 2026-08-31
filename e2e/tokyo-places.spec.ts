import { expect, test } from "@playwright/test";

test("Tokyo place mode lazy-loads and starts a typable session", async ({ page }) => {
  await page.goto("/");
  const tokyoMode = page.getByRole("radio", { name: /東京地名/ });
  await page.locator("label.mode-option").filter({ hasText: "東京地名" }).click();
  await expect(tokyoMode).toBeChecked();
  await page.getByRole("button", { name: /60秒トレーニングを始める/ }).click();

  await expect(page.locator(".prompt-description")).toContainText(/鉄道駅|河川|都市公園|山|島|市区町村|行政名/);
  const input = await page.locator(".roman-line").getAttribute("aria-label");
  expect(input).toMatch(/^入力: .+/);
  const remaining = (await page.locator(".roman-remaining").textContent()) ?? "";
  await page.keyboard.type(remaining[0] ?? "");
  await expect(page.locator(".roman-typed")).not.toHaveText("");
});
