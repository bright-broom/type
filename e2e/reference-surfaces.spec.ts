import { expect, test } from "@playwright/test";
import { expectNoPageFailures, observePageFailures } from "./support/browser-health.ts";
import { CRITICAL_TYPING_VIEWPORTS, expectNoHorizontalOverflow } from "./support/typing-layout-assertions.ts";

for (const viewport of CRITICAL_TYPING_VIEWPORTS) {
  test(`local dictionaries filter accurately at ${viewport.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = observePageFailures(page);
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

    await expectNoHorizontalOverflow(page);
    await expectNoPageFailures(failures);
    await context.close();
  });
}
