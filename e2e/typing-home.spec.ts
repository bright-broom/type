import { expect, test } from "@playwright/test";
import { expectNoPageFailures, observePageFailures } from "./support/browser-health.ts";
import {
  expectHomeActionsNotClipped,
  expectNoHorizontalOverflow,
  TYPING_VIEWPORTS,
} from "./support/typing-layout-assertions.ts";

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
    await expect(page.getByRole("button", { name: /60秒トレーニングを始める/ })).toBeVisible();
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

    await expect(page.getByRole("button", { name: /60秒トレーニングを始める/ })).toBeInViewport();
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
  await page.getByRole("button", { name: /60秒トレーニングを始める/ }).click();
  await page.clock.fastForward(65_000);
  await page.getByRole("button", { name: "ホームへ" }).click();

  await expect(page.getByRole("heading", { name: "前回の60秒" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "言葉を見てから練習" })).toBeInViewport();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1))
    .toBe(true);
  await expectHomeActionsNotClipped(page, "returning-user laptop");

  await context.close();
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
  await expect(page.getByRole("button", { name: /60秒トレーニングを始める/ })).toBeFocused();
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
