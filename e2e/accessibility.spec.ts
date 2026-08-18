import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * `eslint-plugin-jsx-a11y` only reads the source, so it cannot see a contrast ratio,
 * a label hidden by a media query, or an ARIA attribute that is invalid for the role
 * the browser actually computed. This runs axe against the rendered pages, on every
 * configured engine, to catch exactly that class of defect.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Impacts that fail the build. Moderate and minor findings are reported, not gated. */
const GATED_IMPACTS = new Set(["critical", "serious"]);

const screens: ReadonlyArray<{ name: string; open: (page: Page) => Promise<void> }> = [
  { name: "home", open: async () => {} },
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
    open: async (page) => {
      await page.getByRole("button", { name: /60秒トレーニング/ }).click();
      await page.clock.fastForward(4_000);
      await page.keyboard.type("a");
      await page.clock.fastForward(61_000);
      await page.getByRole("heading", { name: "おつかれさまでした。" }).waitFor();
    },
  },
];

for (const screen of screens) {
  test(`${screen.name} has no serious accessibility violations`, async ({ browser }) => {
    // A phone viewport is the strict case: labels collapse and type shrinks there.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
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
