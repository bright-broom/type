import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "compact-phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone-landscape", width: 667, height: 375 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const criticalViewports = [viewports[0], viewports[2], viewports[4]];
const layoutBoundaryWidths = [900, 901, 1100, 1101] as const;

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

async function expectNoFailures(page: Page, failures: string[]) {
  await page.waitForTimeout(150);
  expect(failures).toEqual([]);
}

async function gridColumnWidths(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) =>
    getComputedStyle(element)
      .gridTemplateColumns.split(" ")
      .map((value) => Number.parseFloat(value)),
  );
}

function expectGoldenRatio(major: number, minor: number) {
  expect(major / minor).toBeCloseTo(1.618, 1);
}

function expectGoldenExpansion(major: number, minor: number) {
  expect(major / minor).toBeCloseTo(2.618, 1);
}

test("home remains operable across layout equivalence classes", async ({ browser }) => {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observeFailures(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /60秒で、.*昨日より軽く。/ })).toBeVisible();
    const japaneseMode = page.getByRole("radio", { name: /日本語/ });
    const consultingMode = page.getByRole("radio", { name: /コンサル/ });
    await expect(japaneseMode).toBeChecked();
    await page.locator("label.mode-option").filter({ hasText: "コンサル" }).click();
    await expect(consultingMode).toBeChecked();
    await expect(japaneseMode).not.toBeChecked();
    const startButton = page.getByRole("button", { name: /60秒トレーニングを始める/ });
    await expect(startButton).toBeVisible();
    expect(
      await startButton.evaluate((element) => element.getBoundingClientRect().bottom <= window.innerHeight),
      `${viewport.name} keeps the start action inside the initial viewport`,
    ).toBe(true);
    await expectNoHorizontalOverflow(page);
    await expectNoFailures(page, failures);

    await context.close();
  }
});

test("golden-ratio layouts preserve hierarchy and collapse safely", async ({ browser }) => {
  for (const viewport of criticalViewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observeFailures(page);
    await page.goto("/");

    const homeColumns = await gridColumnWidths(page, ".home-shell");
    if (viewport.name === "desktop") {
      expect(homeColumns).toHaveLength(2);
      expectGoldenRatio(homeColumns[0], homeColumns[1]);
    } else {
      expect(homeColumns).toHaveLength(1);
    }
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "表示設定" }).click();
    await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();
    const settingsColumns = await gridColumnWidths(page, ".settings-shell");
    if (viewport.name === "desktop") {
      expect(settingsColumns).toHaveLength(2);
      expectGoldenExpansion(settingsColumns[1], settingsColumns[0]);
    } else {
      expect(settingsColumns).toHaveLength(1);
    }
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /戻る/ }).click();

    await page.getByRole("button", { name: /コンサル実務辞典を開く/ }).click();
    await expect(page.getByRole("heading", { name: "コンサル実務辞典" })).toBeVisible();
    const playbookColumns = await gridColumnWidths(page, ".playbook-layout");
    if (viewport.name === "desktop") {
      expect(playbookColumns).toHaveLength(2);
      expectGoldenExpansion(playbookColumns[1], playbookColumns[0]);
    } else {
      expect(playbookColumns).toHaveLength(1);
    }
    await expectNoHorizontalOverflow(page);
    await expectNoFailures(page, failures);
    await context.close();
  }
});

test("layout breakpoints keep golden hierarchy or collapse deliberately", async ({ browser }) => {
  for (const width of layoutBoundaryWidths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto("/");

    const homeColumns = await gridColumnWidths(page, ".home-shell");
    expect(homeColumns).toHaveLength(width <= 900 ? 1 : 2);
    if (width > 900) expectGoldenRatio(homeColumns[0], homeColumns[1]);

    await page.getByRole("button", { name: /宅建試験 完全用語一覧を開く/ }).click();
    const filterColumns = await gridColumnWidths(page, ".glossary-filters");
    expect(filterColumns).toHaveLength(width <= 1100 ? 2 : 5);
    if (width > 900) expectGoldenRatio(filterColumns[0], filterColumns[1]);
    await expectNoHorizontalOverflow(page);
    await context.close();
  }
});

test("Enter starts the mode selected in quick start", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const consultingMode = page.getByRole("radio", { name: /コンサル/ });
  await page.locator("label.mode-option").filter({ hasText: "コンサル" }).click();
  await consultingMode.focus();
  await expect(consultingMode).toBeFocused();
  await page.keyboard.press("Enter");
  await page.clock.fastForward(4_000);

  await expect(page.locator(".prompt-reading")).toHaveText("CONSULTING TERM");
});

test("calendar keeps all stored days and safely renders partial legacy records", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const augustSessions = Array.from({ length: 20 }, (_, index) => ({
    id: `august-${index}`,
    score: 2_000 + index,
    endedAt: new Date(2026, 7, 31, 12, index).getTime(),
  }));
  const julySession = {
    id: "july-legacy",
    score: 1_500,
    endedAt: new Date(2026, 6, 15, 9, 0).getTime(),
  };
  const retainedDailyScore = {
    dateKey: "2026-06-10",
    day: 10,
    bestScore: 1_250,
    sessionCount: 3,
  };
  await context.addInitScript(
    ({ sessions, dailyScores }) => {
      window.localStorage.setItem("typeloop:data", JSON.stringify({ version: 1, sessions, dailyScores, settings: {} }));
    },
    { sessions: [...augustSessions, julySession], dailyScores: [retainedDailyScore] },
  );
  const page = await context.newPage();
  await page.goto("/");

  await page.getByRole("button", { name: "記録" }).click();
  await expect(page.getByRole("heading", { name: "日々のスコア" })).toBeVisible();
  await expect(page.getByText("計測不可").first()).toBeVisible();
  await page.getByRole("button", { name: "前の月" }).click();
  await page.getByRole("button", { name: "前の月" }).click();
  await page.getByRole("button", { name: /6月10日 最高スコア 1,250 3回/ }).click();
  await expect(page.getByText(/セッション詳細の保存期間は終了/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await context.close();
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
    if (viewport.name === "desktop") {
      const gameMetaColumns = await gridColumnWidths(page, ".game-meta");
      expect(gameMetaColumns).toHaveLength(3);
      expectGoldenExpansion(gameMetaColumns[1], gameMetaColumns[0]);
      const liveStatColumns = await gridColumnWidths(page, ".live-stats");
      expect(liveStatColumns).toHaveLength(4);
      expectGoldenRatio(liveStatColumns[0], liveStatColumns[1]);
    }
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
    if (viewport.name === "desktop") {
      const metricColumns = await gridColumnWidths(page, ".metric-grid");
      expect(metricColumns).toHaveLength(5);
      expectGoldenRatio(metricColumns[0], metricColumns[1]);
    }
    await expectNoHorizontalOverflow(page);
    const historyButton = page.getByRole("button", { name: viewport.name === "desktop" ? "記録" : /練習履歴/ });
    if (viewport.name === "desktop") {
      await historyButton.focus();
      await page.keyboard.press("Enter");
    } else await historyButton.click();
    await expect(page.getByRole("heading", { name: "練習の記録" })).toBeVisible();
    await expect(page.locator(".history-shell")).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const scoredDay = page.locator(".history-calendar__day[data-has-score]");
    await expect(scoredDay).toHaveCount(1);
    if (viewport.name === "compact-phone") {
      expect(await scoredDay.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
    }
    await scoredDay.click();
    await expect(scoredDay).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: /月\d+日の記録/ })).toBeVisible();
    await expect(page.locator(".history-row:not(.history-labels)")).toHaveCount(1);
    await page.getByRole("button", { name: "絞り込みを解除" }).click();
    await expect(page.getByRole("heading", { name: "すべての練習" })).toBeVisible();
    await page.getByRole("button", { name: "次の月" }).click();
    await expect(page.locator(".history-calendar__day[data-has-score]")).toHaveCount(0);
    await page.getByRole("button", { name: "前の月" }).click();
    await expect(page.locator(".history-calendar__day[data-has-score]")).toHaveCount(1);
    if (viewport.name === "desktop") {
      const historyColumns = await gridColumnWidths(page, ".history-row:not(.history-labels)");
      expect(historyColumns).toHaveLength(4);
      expectGoldenRatio(historyColumns[0], historyColumns[1]);
      const overviewColumns = await gridColumnWidths(page, ".history-overview");
      expect(overviewColumns).toHaveLength(4);
      expectGoldenRatio(overviewColumns[0], overviewColumns[1]);
    }
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

test("a session that local storage rejects remains recoverable through JSON", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === "typeloop:data") throw new DOMException("Storage full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    };
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒トレーニングを始める/ }).click();
  await page.clock.fastForward(65_000);

  await expect(page.locator(".notice[role='alert']")).toContainText("ページを閉じる前に");
  await page.getByRole("button", { name: "サウンド ON" }).click();
  await expect(page.locator(".notice[role='alert']")).toContainText("ページを閉じる前に");
  await page.getByRole("button", { name: /練習履歴/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONで保存" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const archive = JSON.parse(await readFile(downloadPath as string, "utf8")) as {
    sessions: Array<{ id: string }>;
  };
  expect(archive.sessions).toHaveLength(1);
  await context.close();
});

test("a later session save does not erase an unresolved settings warning", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    let rejectedTypeloopWrite = false;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === "typeloop:data" && !rejectedTypeloopWrite) {
        rejectedTypeloopWrite = true;
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "サウンド ON" }).click();
  await expect(page.locator(".notice[role='alert']")).toContainText("設定を端末に保存できませんでした");
  await page.getByRole("button", { name: /60秒トレーニングを始める/ }).click();
  await page.clock.fastForward(65_000);
  await expect(page.locator(".notice[role='alert']")).toContainText("設定を端末に保存できませんでした");
  await context.close();
});

test("touch controls meet the minimum tap target on every phone size", async ({ browser }) => {
  // Height alone was constrained before, so icon-only controls stayed under 44px wide.
  for (const viewport of [viewports[0], viewports[1], viewports[2]]) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".icon-button")).toBeVisible();
    const undersized = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href], select, label.mode-option")]
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
    if (viewport.name === "desktop") {
      const takkenFilterColumns = await gridColumnWidths(page, ".glossary-filters");
      expect(takkenFilterColumns).toHaveLength(5);
      expectGoldenRatio(takkenFilterColumns[0], takkenFilterColumns[1]);
    }
    const takkenSearch = page.getByRole("searchbox", { name: /キーワード検索/ });
    await takkenSearch.fill("抵当権");
    await expect(page.locator(".glossary-entry").first()).toContainText("抵当権");
    await takkenSearch.fill("__NO_MATCH__");
    await expect(page.getByText("一致する用語はありません。")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /ホームへ/ }).click();

    await page.getByRole("button", { name: /週次定例会議 用語辞典を開く/ }).click();
    await expect(page.getByRole("heading", { name: "AIS週次定例会議 用語辞典" })).toBeVisible();
    if (viewport.name === "desktop") {
      const aisFilterColumns = await gridColumnWidths(page, ".ais-filters");
      expect(aisFilterColumns).toHaveLength(6);
      expectGoldenRatio(aisFilterColumns[0], aisFilterColumns[1]);
    }
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
