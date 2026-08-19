import { expect, test } from "@playwright/test";

test("the takken hub connects assessment, glossary, and typing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "宅建試験対策を開く" }).click();
  await expect(page).toHaveURL(/\/takken$/);
  await expect(page.getByRole("heading", { name: /覚える。解く。.*また戻る。/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /10問演習/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /本番模試/ })).toBeVisible();

  await page.getByRole("link", { name: /用語タイピング/ }).click();
  await expect(page.getByRole("radio", { name: /宅建/ })).toBeChecked();
});

test("practice answers with number keys, explains immediately, and survives reload", async ({ page }) => {
  await page.goto("/takken/practice");
  await page.getByRole("button", { name: "10問演習を始める" }).click();
  await expect(page.getByText("1 / 10")).toBeVisible();

  await page.keyboard.press("2");
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await expect(page.getByRole("status")).toContainText(/正解です|もう一度整理しましょう/);
  await page.getByRole("button", { name: /次の問題/ }).click();
  await expect(page.getByText("2 / 10")).toBeVisible();

  await page.reload();
  await expect(page.getByText("2 / 10")).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByRole("radio").first()).toBeChecked();
});

test("a persisted answer that no longer exists in the question pack is discarded", async ({ page }) => {
  await page.goto("/takken/practice");
  await page.getByRole("button", { name: "10問演習を始める" }).click();
  await page.keyboard.press("1");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("typeloop:assessment-active:v1");
        return raw ? Object.keys(JSON.parse(raw).answers).length : 0;
      }),
    )
    .toBe(1);
  await page.evaluate(() => {
    const key = "typeloop:assessment-active:v1";
    const attempt = JSON.parse(localStorage.getItem(key) ?? "null");
    const questionId = attempt.questionIds[0];
    attempt.answers[questionId].choiceId = "not-a-real-choice";
    localStorage.setItem(key, JSON.stringify(attempt));
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "10問演習を始める" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("typeloop:assessment-active:v1"))).toBeNull();
});

test("a completed practice session is scored and added to local history", async ({ page }) => {
  await page.goto("/takken/practice");
  await page.getByRole("button", { name: "10問演習を始める" }).click();
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("1");
    if (index < 9) await page.getByRole("button", { name: /次の問題/ }).click();
  }
  await page.getByRole("button", { name: "採点する" }).click();
  await expect(page.getByRole("dialog", { name: "この内容で採点しますか？" })).toContainText("未回答は0問");
  await page.getByRole("button", { name: "提出して採点" }).click();
  await expect(page.locator(".assessment-result-shell")).toBeFocused();
  await expect(page.locator(".assessment-result-shell > h1")).toContainText("/ 10");
  await expect(page.getByText(/正答率/).first()).toBeVisible();
  await page
    .getByRole("link", { name: /この用語を確認/ })
    .first()
    .click();
  await expect(page.getByRole("searchbox", { name: /キーワード検索/ })).not.toHaveValue("");

  await page.goto("/takken/history");
  await expect(page.getByRole("heading", { name: "試験記録" })).toBeVisible();
  await expect(page.locator(".assessment-history-list li")).toHaveCount(1);
  await expect(page.locator(".assessment-history-list li")).toContainText("10問演習");
});

test("the exempt mock uses 45 questions, review flags, and a continuing deadline", async ({ page }) => {
  await page.clock.install();
  await page.goto("/takken/mock");
  await page.getByRole("button", { name: /5問免除/ }).click();
  await expect(page.getByText("1 / 45")).toBeVisible();
  await expect(page.getByRole("timer", { name: "残り時間" })).toContainText("01:50:00");
  await page.getByRole("button", { name: "☆ 見直し" }).click();
  await expect(page.getByRole("button", { name: "★ 見直す" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("4");
  await page.getByRole("button", { name: /次の問題/ }).click();
  await page.reload();
  await expect(page.getByText("2 / 45")).toBeVisible();

  await page.clock.fastForward(110 * 60 * 1_000 + 1_000);
  await expect(page.locator(".assessment-result-shell > h1")).toContainText("/ 45");
});

test("assessment completion surfaces stay operable within a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/takken/practice");
  await page.getByRole("button", { name: "10問演習を始める" }).click();
  await page.getByText("解答状況を見る").click();
  await page.getByRole("button", { name: "現在の回答を提出" }).click();
  const dialog = page.getByRole("dialog", { name: "この内容で採点しますか？" });
  await expect(dialog).toBeVisible();
  for (const button of await dialog.getByRole("button").all()) {
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: "戻る" }).click();
  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press("1");
    if (index < 9) await page.getByRole("button", { name: /次の問題/ }).click();
  }
  await page.getByRole("button", { name: "採点する" }).click();
  await page.getByRole("button", { name: "提出して採点" }).click();
  await expect(page.locator(".assessment-result-shell")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );

  await page.goto("/takken/history");
  await expect(page.getByRole("heading", { name: "試験記録" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
});
