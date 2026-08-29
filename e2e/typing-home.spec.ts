import { expect, test } from "@playwright/test";
import { expectNoPageFailures, observePageFailures } from "./support/browser-health.ts";
import {
  expectHomeActionsNotClipped,
  expectNoHorizontalOverflow,
  TYPING_VIEWPORTS,
} from "./support/typing-layout-assertions.ts";

function storedSession(
  id: string,
  trainingSet: "japanese" | "consulting",
  score: number,
  wpm: number,
  endedAt: number,
) {
  return {
    id,
    mode: "60s",
    trainingSet,
    startedAt: endedAt - 60_000,
    endedAt,
    prompts: [],
    keystrokes: [],
    metrics: {
      correctKeystrokes: wpm * 5,
      totalKeystrokes: wpm * 5,
      accuracy: 100,
      wpm,
      cpm: wpm * 5,
      elapsedMs: 60_000,
    },
    score,
    completedPrompts: 1,
    maxCombo: wpm * 5,
    weakKeys: [],
  };
}

test("home remains operable across layout equivalence classes", async ({ browser }) => {
  for (const viewport of TYPING_VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observePageFailures(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /60秒で、.*昨日より軽く。/ })).toBeVisible();
    await expect(page.getByText("迷う時間をなくして、正確さとリズムだけに集中するタイピング習慣。")).toBeVisible();
    const japaneseMode = page.getByRole("radio", { name: /日本語/ });
    const consultingMode = page.getByRole("radio", { name: /コンサル/ });
    await expect(japaneseMode).toBeChecked();
    await page.locator("label[data-mode-option]").filter({ hasText: "コンサル" }).click();
    await expect(consultingMode).toBeChecked();
    await expect(japaneseMode).not.toBeChecked();
    await expect(page.getByRole("button", { name: /60秒練習する/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectHomeActionsNotClipped(page, viewport.name);
    await expectNoPageFailures(failures);

    await context.close();
  }
});

test("home fits within standard laptop first views", async ({ browser }) => {
  for (const viewport of TYPING_VIEWPORTS.filter(({ name }) => name === "laptop" || name === "desktop")) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByRole("button", { name: /60秒練習する/ })).toBeInViewport();
    await expect(page.getByRole("heading", { name: "言葉を見てから練習" })).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1))
      .toBe(true);

    await context.close();
  }
});

test("returning-user progress also fits the laptop first view", async ({ browser }) => {
  const context = await browser.newContext({ viewport: TYPING_VIEWPORTS[4] });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒練習する/ }).click();
  await page.clock.fastForward(65_000);
  await page.getByRole("button", { name: "ホームへ" }).click();

  await expect(page.getByRole("heading", { name: "日本語の前回記録" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "言葉を見てから練習" })).toBeInViewport();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1))
    .toBe(true);
  await expectHomeActionsNotClipped(page, "returning-user laptop");

  await context.close();
});

test("primary action and progress stay scoped to the selected mode", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");

  await page.locator("label[data-mode-option]").filter({ hasText: "コンサル" }).click();
  await expect(page.getByRole("button", { name: "コンサル用語を60秒練習する" })).toBeVisible();
  await page.getByRole("button", { name: "コンサル用語を60秒練習する" }).click();
  await page.clock.fastForward(65_000);
  await page.getByRole("button", { name: "ホームへ" }).click();

  const progress = page.getByRole("complementary", { name: "トレーニング進捗" });
  await expect(progress.getByRole("heading", { name: "コンサル用語の前回記録" })).toBeVisible();
  await expect(progress.getByText("ベストスコア", { exact: true })).toBeVisible();
  await expect(progress.getByText("日本語 BEST", { exact: true })).toHaveCount(0);

  await page.locator("label[data-mode-option]").filter({ hasText: "日本語" }).click();
  await expect(page.getByRole("button", { name: "日本語を60秒練習する" })).toBeVisible();
  await expect(progress.getByRole("heading", { name: "日本語を始めよう" })).toBeVisible();
  await expect(progress.getByText("LAST WPM", { exact: true })).toHaveCount(0);
});

test("mode progress uses retained history beyond the twenty visible sessions", async ({ page }) => {
  const japaneseSessions = Array.from({ length: 20 }, (_, index) =>
    storedSession(`japanese-${index}`, "japanese", index === 0 ? 1_200 : 100, 20, 2_000 - index),
  );
  const consultingSession = storedSession("consulting-older", "consulting", 9_001, 90, 1_000);
  await page.addInitScript(
    (sessions) => {
      localStorage.setItem("typeloop:data", JSON.stringify({ version: 2, sessions, settings: { soundEnabled: true } }));
    },
    [...japaneseSessions, consultingSession],
  );
  await page.goto("/");

  const progress = page.getByRole("complementary", { name: "トレーニング進捗" });
  await expect(progress.getByRole("heading", { name: "日本語の前回記録" })).toBeVisible();
  await expect(progress.getByText("1,200", { exact: true })).toBeVisible();

  await page.locator("label[data-mode-option]").filter({ hasText: "コンサル" }).click();
  await expect(progress.getByRole("heading", { name: "コンサル用語の前回記録" })).toBeVisible();
  await expect(progress.getByText("9,001", { exact: true })).toBeVisible();
  await expect(progress.getByText("90", { exact: true })).toBeVisible();
});

test("the completed session remains visible when local storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒練習する/ }).click();
  await page.clock.fastForward(65_000);
  await page.getByRole("button", { name: "ホームへ" }).click();

  const progress = page.getByRole("complementary", { name: "トレーニング進捗" });
  await expect(progress.getByRole("heading", { name: "日本語の前回記録" })).toBeVisible();
});

test("keyboard navigation reaches the primary task before secondary controls", async ({ page, browserName }) => {
  await page.goto("/");
  // WebKit models Safari's macOS default, where Option+Tab opts into control
  // navigation. In browsers with full keyboard access enabled, plain Tab is used.
  const moveFocusForward = browserName === "webkit" ? "Alt+Tab" : "Tab";

  const skipLink = page.getByRole("button", { name: "練習モードへ移動" });
  await page.keyboard.press(moveFocusForward);
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  const quickStart = page.locator("#quick-start");
  await expect(quickStart).toBeFocused();
  await expect(quickStart).toHaveCSS("outline-style", "solid");
  await expect(quickStart).toHaveCSS("outline-width", "3px");

  await page.keyboard.press(moveFocusForward);
  const japaneseMode = page.getByRole("radio", { name: /日本語/ });
  await expect(japaneseMode).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /コンサル/ })).toBeChecked();
  await page.keyboard.press(moveFocusForward);
  await expect(page.getByRole("button", { name: /60秒練習する/ })).toBeFocused();
});

test("Enter starts the mode selected in quick start", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const consultingMode = page.getByRole("radio", { name: /コンサル/ });
  await page.locator("label[data-mode-option]").filter({ hasText: "コンサル" }).click();
  await consultingMode.focus();
  await expect(consultingMode).toBeFocused();
  await page.keyboard.press("Enter");
  await page.clock.fastForward(4_000);

  await expect(page.locator(".prompt-reading")).toHaveText("CONSULTING TERM");
});
