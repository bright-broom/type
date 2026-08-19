import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "compact-phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone-landscape", width: 667, height: 375 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const criticalViewports = [viewports[0], viewports[2], viewports[5]];

function observeFailures(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown";
    if (!reason.includes("ERR_ABORTED")) failures.push(`request: ${request.url()} (${reason})`);
  });
  return failures;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}

async function expectHomeActionsNotClipped(page: Page, viewportName: string) {
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main a[href], main label[data-mode-option]")]
      .map((element) => ({
        element,
        box: element.getBoundingClientRect(),
      }))
      .filter(
        ({ element, box }) =>
          box.width > 0 &&
          (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1),
      )
      .map(
        ({ element, box }) =>
          `${element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName} ${Math.round(box.width)}x${Math.round(box.height)}`,
      ),
  );
  expect(clipped, `${viewportName} has a clipped home action`).toEqual([]);
}

async function expectNoFailures(page: Page, failures: string[]) {
  await page.waitForTimeout(150);
  expect(failures).toEqual([]);
}

test("home remains operable across layout equivalence classes", async ({ browser }) => {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observeFailures(page);

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
    await expectNoFailures(page, failures);

    await context.close();
  }
});

test("home fits within standard laptop first views", async ({ browser }) => {
  for (const viewport of viewports.filter(({ name }) => name === "laptop" || name === "desktop")) {
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
  const context = await browser.newContext({ viewport: viewports[4] });
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

test("critical flow stays operable from compact portrait through landscape and desktop", async ({ browser }) => {
  for (const viewport of criticalViewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observeFailures(page);
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("button", { name: /60秒トレーニングを始める/ }).click();
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
    await expect(page.locator(".history-shell")).toBeFocused();
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
      sessions: Array<{ id: string }>;
    };
    expect(archive.format).toBe("typeloop-session-history");
    expect(archive.version).toBe(1);
    expect(archive.sessions).toHaveLength(1);
    await expect(page.getByRole("status")).toHaveText("JSONファイルに保存しました。");
    await expectNoHorizontalOverflow(page);
    await expectNoFailures(page, failures);
    await context.close();
  }
});

test("touch controls meet the minimum tap target on every phone size", async ({ browser }) => {
  // Height alone was constrained before, so icon-only controls stayed under 44px wide.
  for (const viewport of [viewports[0], viewports[1], viewports[2]]) {
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
  const failures = observeFailures(page);
  await page.clock.install();
  await page.goto("/");

  const focusedLabel = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
  await page.getByRole("button", { name: /60秒トレーニング/ }).tap();
  // Focus must land during the countdown: a software keyboard only opens while the
  // starting gesture is still being handled.
  expect(await focusedLabel()).toBe("タイピング入力");
  await page.clock.fastForward(4_000);
  expect(await focusedLabel()).toBe("タイピング入力");

  // Dismissing the keyboard is recoverable by tapping the play area.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await focusedLabel()).toBeNull();
  await page.locator(".prompt-stage h1").tap();
  expect(await focusedLabel()).toBe("タイピング入力");

  // Pausing releases the keyboard; resuming takes it back.
  await page.getByRole("button", { name: /一時停止/ }).tap();
  await expect(page.getByRole("dialog", { name: "ひと休み。" })).toBeVisible();
  await page.getByRole("button", { name: /トレーニングを再開/ }).tap();
  expect(await focusedLabel()).toBe("タイピング入力");

  await expectNoFailures(page, failures);
  await context.close();
});

test("kana from a keyboard left in Japanese mode is explained, not scored as a miss", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const failures = observeFailures(page);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒トレーニング/ }).tap();
  await page.clock.fastForward(4_000);

  const missCount = page.locator(".live-stats > div").filter({ hasText: "ミス" }).locator("strong");
  await page.getByRole("textbox", { name: "タイピング入力" }).fill("あいう");
  await expect(page.locator(".feedback-line")).toContainText("英数字キーボードに切り替え");
  await expect(page.locator(".roman-typed")).toHaveText("");
  await expect(missCount).toHaveText("0");

  // Latin input still works straight after the guidance.
  const fullInput = (await page.locator(".roman-line").getAttribute("aria-label"))?.replace(/^入力:\s*/, "") ?? "";
  await page.getByRole("textbox", { name: "タイピング入力" }).fill(fullInput[0] ?? "a");
  await expect(page.locator(".roman-typed")).not.toHaveText("");

  await expectNoFailures(page, failures);
  await context.close();
});

test("the prompt and the typing field stay visible in the space a keyboard leaves", async ({ browser }) => {
  // 390x420 approximates a 390x844 phone with a ~420px software keyboard open.
  const context = await browser.newContext({ viewport: { width: 390, height: 420 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const failures = observeFailures(page);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒トレーニング/ }).tap();
  await page.clock.fastForward(4_000);

  await expect(page.locator(".prompt-stage h1")).toBeInViewport();
  await expect(page.locator(".roman-line")).toBeInViewport();
  await expect(page.getByRole("textbox", { name: "タイピング入力" })).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  await expectNoFailures(page, failures);
  await context.close();
});

test("touch input processes multi-character IME events sequentially", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const failures = observeFailures(page);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒トレーニング/ }).tap();
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
  await expectNoFailures(page, failures);
  await context.close();
});

test("local dictionaries filter accurately across responsive layout classes", async ({ browser }) => {
  for (const viewport of criticalViewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observeFailures(page);
    await page.goto("/");

    await page.getByRole("button", { name: /コンサル実務辞典を開く/ }).click();
    await expect(page.getByRole("heading", { name: "コンサル実務辞典" })).toBeVisible();
    await expect(page.locator(".playbook-shell")).toBeFocused();
    await page
      .getByRole("navigation", { name: "Playbook セクション" })
      .getByRole("button", { name: /17 学習ロードマップ/ })
      .click();
    const consultingSearch = page.getByRole("searchbox", { name: /辞典を検索/ });
    await consultingSearch.fill("MECE");
    await expect(page.locator(".playbook-rows article")).toHaveCount(1);
    await expect(page.locator(".playbook-rows article")).toContainText("MECE");
    await expect(page.locator(".playbook-rows")).not.toContainText("Communication");
    await consultingSearch.fill("__NO_MATCH__");
    await expect(page.getByText("一致する項目はありません。")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /ホームへ/ }).click();

    await page.getByRole("button", { name: /宅建試験 完全用語一覧を開く/ }).click();
    await expect(page.getByRole("heading", { name: "宅建試験 完全用語一覧" })).toBeVisible();
    const takkenSearch = page.getByRole("searchbox", { name: /キーワード検索/ });
    await takkenSearch.fill("抵当権");
    await expect(page.locator(".glossary-entry").first()).toContainText("抵当権");
    await takkenSearch.fill("__NO_MATCH__");
    await expect(page.getByText("一致する用語はありません。")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /ホームへ/ }).click();

    await page.getByRole("button", { name: /週次定例会議 用語辞典を開く/ }).click();
    await expect(page.getByRole("heading", { name: "AIS週次定例会議 用語辞典" })).toBeVisible();
    const aisSearch = page.getByRole("searchbox", { name: /キーワード検索/ });
    await aisSearch.fill("パイプライン");
    await expect(page.locator(".glossary-entry").first()).toContainText("パイプライン");
    // De-identified parties must reach the browser as pseudonyms only.
    await aisSearch.fill("顧客A");
    await expect(page.locator(".glossary-entry").first()).toContainText("実名非開示");
    await aisSearch.fill("__NO_MATCH__");
    await expect(page.getByText("一致する用語はありません。")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoFailures(page, failures);
    await context.close();
  }
});
