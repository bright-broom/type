import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "compact-phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone-landscape", width: 667, height: 375 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const criticalViewports = [viewports[0], viewports[2], viewports[4]];

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

test("home remains operable across layout equivalence classes", async ({ browser }) => {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observeFailures(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /タイピングを、.*習慣に。/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /60秒トレーニング/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoFailures(page, failures);

    await context.close();
  }
});

test("critical flow stays operable from compact portrait through landscape and desktop", async ({ browser }) => {
  for (const viewport of criticalViewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observeFailures(page);
    await page.clock.install();
    await page.goto("/");
    await page.getByRole("button", { name: /60秒トレーニング/ }).click();
    await page.clock.fastForward(4_000);

    const inputGuide = page.locator(".roman-line");
    await expect(inputGuide).toBeVisible();
    const fullInput = (await inputGuide.getAttribute("aria-label"))?.replace(/^入力:\s*/, "") ?? "";
    expect(fullInput.length).toBeGreaterThan(0);
    await page.keyboard.type(fullInput[0]);
    await expect(page.locator(".roman-typed")).not.toHaveText("");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /一時停止/ }).click();
    await expect(page.getByRole("dialog", { name: "ひと休み。" })).toBeVisible();
    await page.getByRole("button", { name: /トレーニングを再開/ }).click();
    await page.clock.fastForward(61_000);

    await expect(page.getByRole("heading", { name: "おつかれさまでした。" })).toBeVisible();
    await expect(page.getByRole("button", { name: /もう一度挑戦/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: /練習履歴/ }).click();
    await expect(page.getByRole("heading", { name: "練習の記録" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoFailures(page, failures);
    await context.close();
  }
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
