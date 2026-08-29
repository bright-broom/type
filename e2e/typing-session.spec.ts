import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { expectNoPageFailures, observePageFailures } from "./support/browser-health.ts";
import {
  CRITICAL_TYPING_VIEWPORTS,
  expectNoHorizontalOverflow,
  TYPING_VIEWPORTS,
} from "./support/typing-layout-assertions.ts";

test("critical flow stays operable from compact portrait through landscape and desktop", async ({ browser }) => {
  for (const viewport of CRITICAL_TYPING_VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observePageFailures(page);
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("button", { name: /60秒練習する/ }).click();
    await page.clock.fastForward(4_000);

    const inputGuide = page.locator(".roman-line");
    await expect(inputGuide).toBeVisible();
    const fullInput = (await inputGuide.getAttribute("aria-label"))?.replace(/^入力:\s*/, "") ?? "";
    expect(fullInput.length).toBeGreaterThan(0);
    await page.keyboard.type(fullInput[0]);
    await expect(page.locator(".roman-typed")).not.toHaveText("");
    await expectNoHorizontalOverflow(page);
    if (viewport.name === "phone-landscape") {
      const minimumStageHeight = await page
        .locator(".prompt-stage")
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).minHeight));
      expect(minimumStageHeight).toBeLessThanOrEqual(225);
    }

    await page.getByRole("button", { name: /一時停止/ }).click();
    await expect(page.getByRole("dialog", { name: "ひと休み。" })).toBeVisible();
    await page.getByRole("button", { name: /トレーニングを再開/ }).click();
    await page.clock.fastForward(61_000);

    await expect(page.getByRole("heading", { name: "おつかれさまでした。" })).toBeVisible();
    await expect(page.locator(".result-shell")).toBeFocused();
    await expect(page.getByRole("button", { name: /同じモードでもう1回/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const historyButton = page.getByRole("button", { name: viewport.name === "desktop" ? "記録" : /練習履歴/ });
    if (viewport.name === "desktop") {
      await historyButton.focus();
      await page.keyboard.press("Enter");
    } else await historyButton.click();
    await expect(page.getByRole("heading", { name: "練習の記録" })).toBeVisible();
    await expect(page.locator("[data-history-root]")).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const saveButton = page.getByRole("button", { name: "JSONで保存" });
    await expect(saveButton).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    if (viewport.name === "desktop") {
      await saveButton.focus();
      await page.keyboard.press("Enter");
    } else await saveButton.click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(download.suggestedFilename()).toMatch(/^typeloop-history-.*\.json$/);
    expect(downloadPath).not.toBeNull();
    const archive = JSON.parse(await readFile(downloadPath as string, "utf8")) as {
      format: string;
      version: number;
      sessions: Array<Record<string, unknown>>;
    };
    expect(archive.format).toBe("typeloop-session-history");
    expect(archive.version).toBe(2);
    expect(archive.sessions).toHaveLength(1);
    expect(archive.sessions[0]).not.toHaveProperty("prompts");
    expect(archive.sessions[0]).not.toHaveProperty("keystrokes");
    await expect(page.getByRole("status")).toHaveText("JSONファイルに保存しました。");
    await expectNoHorizontalOverflow(page);
    await expectNoPageFailures(failures);
    await context.close();
  }
});

test("result comparison names the score-selected baseline", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒練習する/ }).click();
  await page.clock.fastForward(65_000);
  await page.getByRole("button", { name: /同じモードでもう1回/ }).click();
  await page.clock.fastForward(65_000);

  await expect(page.getByText(/最高スコア記録時比/)).toBeVisible();
  await expect(page.getByText(/vs BEST/)).toHaveCount(0);
});

test("touch controls meet the minimum tap target on every phone size", async ({ browser }) => {
  // Height alone was constrained before, so icon-only controls stayed under 44px wide.
  for (const viewport of [TYPING_VIEWPORTS[0], TYPING_VIEWPORTS[1], TYPING_VIEWPORTS[2]]) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".icon-button")).toBeVisible();
    const undersized = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href], select, label[data-mode-option]")]
        .map((element) => ({ element, box: element.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && (box.width < 44 || box.height < 44))
        .map(
          ({ element, box }) =>
            `${element.className || element.tagName} ${Math.round(box.width)}x${Math.round(box.height)}`,
        ),
    );
    expect(undersized, `${viewport.name} has undersized touch controls`).toEqual([]);
    await context.close();
  }
});

test("a phone opens its keyboard from the start tap and keeps the field focused", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const failures = observePageFailures(page);
  await page.clock.install();
  await page.goto("/");

  const focusedLabel = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
  await page.getByRole("button", { name: /60秒練習する/ }).tap();
  // Focus must land during the countdown: a software keyboard only opens while the
  // starting gesture is still being handled.
  expect(await focusedLabel()).toBe("タイピング入力");
  await page.clock.fastForward(4_000);
  expect(await focusedLabel()).toBe("タイピング入力");

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await focusedLabel()).toBeNull();
  await page.locator(".prompt-stage h1").tap();
  expect(await focusedLabel()).toBe("タイピング入力");

  await page.getByRole("button", { name: /一時停止/ }).tap();
  await expect(page.getByRole("dialog", { name: "ひと休み。" })).toBeVisible();
  await page.getByRole("button", { name: /トレーニングを再開/ }).tap();
  expect(await focusedLabel()).toBe("タイピング入力");

  await expectNoPageFailures(failures);
  await context.close();
});

test("kana from a keyboard left in Japanese mode is explained, not scored as a miss", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const failures = observePageFailures(page);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒練習する/ }).tap();
  await page.clock.fastForward(4_000);

  const missCount = page.locator(".live-stats > div").filter({ hasText: "ミス" }).locator("strong");
  await page.getByRole("textbox", { name: "タイピング入力" }).fill("あいう");
  await expect(page.locator(".feedback-line")).toContainText("英数字キーボードに切り替え");
  await expect(page.locator(".roman-typed")).toHaveText("");
  await expect(missCount).toHaveText("0");

  const fullInput = (await page.locator(".roman-line").getAttribute("aria-label"))?.replace(/^入力:\s*/, "") ?? "";
  await page.getByRole("textbox", { name: "タイピング入力" }).fill(fullInput[0] ?? "a");
  await expect(page.locator(".roman-typed")).not.toHaveText("");

  await expectNoPageFailures(failures);
  await context.close();
});

test("the prompt and the typing field stay visible in the space a keyboard leaves", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 420 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const failures = observePageFailures(page);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒練習する/ }).tap();
  await page.clock.fastForward(4_000);

  await expect(page.locator(".prompt-stage h1")).toBeInViewport();
  await expect(page.locator(".roman-line")).toBeInViewport();
  await expect(page.getByRole("textbox", { name: "タイピング入力" })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  await expectNoPageFailures(failures);
  await context.close();
});

test("touch input processes multi-character IME events sequentially", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const failures = observePageFailures(page);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒練習する/ }).tap();
  await page.clock.fastForward(4_000);

  const inputGuide = page.locator(".roman-line");
  const fullInput = (await inputGuide.getAttribute("aria-label"))?.replace(/^入力:\s*/, "") ?? "";
  const touchInput = page.getByRole("textbox", { name: "タイピング入力" });
  const missCount = page.locator(".live-stats > div").filter({ hasText: "ミス" }).locator("strong");
  await expect(touchInput).toBeVisible();
  expect(fullInput.length).toBeGreaterThan(1);
  await touchInput.fill(fullInput.slice(0, 2));
  await expect(page.locator(".roman-typed")).toHaveText(fullInput.slice(0, 2));
  await expect(missCount).toHaveText("0");
  await expectNoHorizontalOverflow(page);
  await expectNoPageFailures(failures);
  await context.close();
});
