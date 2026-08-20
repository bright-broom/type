import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { submitAnsweredPractice } from "./support/assessment-fixtures.ts";

/**
 * `eslint-plugin-jsx-a11y` only reads the source, so it cannot see a contrast ratio,
 * a label hidden by a media query, or an ARIA attribute that is invalid for the role
 * the browser actually computed. This runs axe against the rendered pages, on every
 * configured engine, to catch exactly that class of defect.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Impacts that fail the build. Moderate and minor findings are reported, not gated. */
const GATED_IMPACTS = new Set(["critical", "serious"]);

type AccessibilityScreen = { name: string; open: (page: Page) => Promise<void> };

async function finishSession(page: Page): Promise<void> {
  await page.getByRole("button", { name: /60秒トレーニング/ }).click();
  await page.clock.fastForward(4_000);
  await page.keyboard.type("a");
  await page.clock.fastForward(61_000);
  await page.getByRole("heading", { name: "おつかれさまでした。" }).waitFor();
}

const screens: ReadonlyArray<AccessibilityScreen> = [
  { name: "home", open: async () => {} },
  {
    name: "appearance settings",
    open: async (page) => {
      await page.getByRole("button", { name: "表示設定" }).click();
      await page.getByRole("heading", { name: "表示設定" }).waitFor();
    },
  },
  {
    name: "consulting playbook",
    open: async (page) => {
      await page.getByRole("button", { name: /コンサル実務辞典を開く/ }).click();
      await page.getByRole("heading", { name: "コンサル実務辞典" }).waitFor();
    },
  },
  {
    name: "takken glossary",
    open: async (page) => {
      await page.getByRole("button", { name: /宅建試験 完全用語一覧を開く/ }).click();
      await page.getByRole("heading", { name: /宅建試験/ }).waitFor();
    },
  },
  {
    name: "ais glossary",
    open: async (page) => {
      await page.getByRole("button", { name: /週次定例会議 用語辞典を開く/ }).click();
      await page.getByRole("heading", { name: /AIS週次定例会議/ }).waitFor();
    },
  },
  {
    name: "game",
    open: async (page) => {
      await page.getByRole("button", { name: /60秒トレーニング/ }).click();
      await page.clock.fastForward(4_000);
      await page.locator(".roman-line").waitFor();
    },
  },
  {
    name: "result",
    open: finishSession,
  },
  {
    name: "history",
    open: async (page) => {
      await finishSession(page);
      await page.getByRole("button", { name: "練習履歴" }).click();
      await page.getByRole("heading", { name: "練習の記録" }).waitFor();
    },
  },
  {
    name: "takken assessment hub",
    open: async (page) => {
      await page.goto("/takken");
      await page.getByRole("heading", { name: /覚える。解く。/ }).waitFor();
    },
  },
  {
    name: "takken practice launcher",
    open: async (page) => {
      await page.goto("/takken/practice");
      await page.getByRole("heading", { name: /理解を確かめる/ }).waitFor();
    },
  },
  {
    name: "takken practice question",
    open: async (page) => {
      await page.goto("/takken/practice");
      await page.getByRole("button", { name: "10問演習を始める" }).click();
      await page.getByRole("group", { name: "選択肢を1つ選んでください" }).waitFor();
    },
  },
  {
    name: "takken submission dialog",
    open: async (page) => {
      await page.goto("/takken/practice");
      await page.getByRole("button", { name: "10問演習を始める" }).click();
      await page.getByText("解答状況を見る").click();
      await page.getByRole("button", { name: "現在の回答を提出" }).click();
      await page.getByRole("dialog", { name: "この内容で採点しますか？" }).waitFor();
    },
  },
  {
    name: "takken assessment result",
    open: submitAnsweredPractice,
  },
  {
    name: "takken assessment history",
    open: async (page) => {
      await submitAnsweredPractice(page);
      await page.goto("/takken/history");
      await page.getByRole("heading", { name: "試験記録" }).waitFor();
    },
  },
  {
    name: "takken mock launcher",
    open: async (page) => {
      await page.goto("/takken/mock");
      await page.getByRole("heading", { name: /本番と同じ時間配分で/ }).waitFor();
    },
  },
];

const representativeThemeScreens = screens.filter(
  ({ name }) => name === "home" || name === "appearance settings" || name === "result",
);
const accessibilityCases: ReadonlyArray<AccessibilityScreen & { theme?: "modern" | "classic" }> = [
  ...screens,
  ...(["modern", "classic"] as const).flatMap((theme) =>
    representativeThemeScreens.map((screen) => ({ ...screen, name: `${theme} ${screen.name}`, theme })),
  ),
];

for (const screen of accessibilityCases) {
  test(`${screen.name} has no serious accessibility violations`, async ({ browser, baseURL }, testInfo) => {
    // Axe traverses all 446 takken entries. Shared Linux runners can exceed the
    // default 30s here, so only this exhaustive screen receives a larger budget.
    if (screen.name === "takken glossary") testInfo.setTimeout(60_000);
    // A phone viewport is the strict case: labels collapse and type shrinks there.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    if (screen.theme) {
      await context.addCookies([
        {
          name: "typeloop-appearance",
          value: `${screen.theme}.comfortable.system`,
          url: baseURL ?? "http://127.0.0.1:4173",
        },
      ]);
    }
    const page = await context.newPage();
    await page.clock.install();
    await page.goto("/");
    await screen.open(page);

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const gated = violations.filter((violation) => GATED_IMPACTS.has(violation.impact ?? ""));
    expect(
      gated.map((violation) => `${violation.impact} ${violation.id} (${violation.nodes.length}): ${violation.help}`),
    ).toEqual([]);

    await context.close();
  });
}

test("the typing field keeps an accessible name while a session runs", async ({ browser }) => {
  // The field is the only way in on a touch device, so its name is load bearing.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /60秒トレーニング/ }).click();
  await page.clock.fastForward(4_000);
  await expect(page.getByRole("textbox", { name: "タイピング入力" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "残り時間" })).toHaveAttribute("aria-valuetext", /残り\d+秒/);
  await context.close();
});

test("keyboard focus remains visible on the full theme option", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "表示設定" }).click();

  const themeInput = page.getByRole("radio", { name: /ライト/ });
  const themeOption = page.locator("label.settings-option").filter({ has: themeInput });
  await themeInput.focus();
  await expect(themeInput).toBeFocused();

  await expect(themeOption).toHaveCSS("outline-style", "solid");
  await expect(themeOption).toHaveCSS("outline-width", "3px");
});
