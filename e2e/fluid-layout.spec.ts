import { expect, test, type Page } from "@playwright/test";
import { expectFluidLayout, type LayoutScreen } from "./support/fluid-layout-assertions.ts";
import { submitAnsweredPractice } from "./support/assessment-fixtures.ts";

const VIEWPORTS = [
  { name: "compact-phone", width: 320, height: 568 },
  { name: "phone-landscape", width: 667, height: 375 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide-desktop", width: 1920, height: 1080 },
] as const;

async function finishSession(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /60秒練習する/ }).click();
  await page.clock.fastForward(4_000);
  await page.keyboard.type("a");
  await page.clock.fastForward(61_000);
  await page.getByRole("heading", { name: "おつかれさまでした。" }).waitFor();
}

const SCREENS: ReadonlyArray<LayoutScreen> = [
  {
    name: "home",
    width: "default",
    open: async (page) => {
      await page.goto("/");
    },
  },
  {
    name: "settings",
    width: "compact",
    open: async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "表示設定" }).click();
    },
  },
  {
    name: "consulting playbook",
    width: "wide",
    open: async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: /コンサル実務辞典を開く/ }).click();
      await page.getByRole("heading", { name: "コンサル実務辞典" }).waitFor();
    },
  },
  {
    name: "takken glossary",
    width: "wide",
    open: async (page) => {
      await page.goto("/takken/glossary");
      await page.getByRole("heading", { name: /宅建試験/ }).waitFor();
    },
  },
  {
    name: "privacy",
    width: "reading",
    open: async (page) => {
      await page.goto("/privacy");
      await page.getByRole("heading", { name: "プライバシーと安全性" }).waitFor();
    },
  },
  {
    name: "game",
    width: "game",
    open: async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: /60秒練習する/ }).click();
      await page.clock.fastForward(4_000);
      await page.locator(".roman-line").waitFor();
    },
  },
  {
    name: "countdown",
    width: "game",
    open: async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: /60秒練習する/ }).click();
      await page.locator(".countdown-shell").waitFor();
    },
  },
  { name: "result", width: "reading", open: finishSession },
  {
    name: "typing history",
    width: "reading",
    open: async (page) => {
      await finishSession(page);
      await page.getByRole("button", { name: "練習履歴" }).click();
    },
  },
  {
    name: "takken hub",
    width: "assessment",
    open: async (page) => {
      await page.goto("/takken");
    },
  },
  {
    name: "practice launcher",
    width: "assessment",
    open: async (page) => {
      await page.goto("/takken/practice");
    },
  },
  {
    name: "mock launcher",
    width: "assessment",
    open: async (page) => {
      await page.goto("/takken/mock");
    },
  },
  {
    name: "assessment history",
    width: "assessment",
    open: async (page) => {
      await page.goto("/takken/history");
    },
  },
  {
    name: "assessment question",
    width: "session",
    open: async (page) => {
      await page.goto("/takken/practice");
      await page.getByRole("button", { name: "10問演習を始める" }).click();
    },
  },
  { name: "assessment result", width: "assessment", open: submitAnsweredPractice },
  {
    name: "error boundary",
    width: "compact",
    open: async (page) => {
      await page.addInitScript(() => {
        const nativeDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = new Proxy(nativeDateTimeFormat, {
          construct(target, args, newTarget) {
            const options = args[1] as Intl.DateTimeFormatOptions | undefined;
            if (args[0] === "ja-JP" && options?.month === "short") throw new Error("layout error probe");
            return Reflect.construct(target, args, newTarget);
          },
        });
      });
      await page.goto("/");
      await page.getByRole("heading", { name: "うまく読み込めませんでした。" }).waitFor();
    },
  },
];

const EVERY_SCREEN_VIEWPORTS = new Set(["compact-phone", "desktop"]);
const REPRESENTATIVE_SCREENS = new Set([
  "home",
  "settings",
  "consulting playbook",
  "game",
  "result",
  "takken hub",
  "assessment question",
]);

for (const viewport of VIEWPORTS) {
  const screens = EVERY_SCREEN_VIEWPORTS.has(viewport.name)
    ? SCREENS
    : SCREENS.filter(({ name }) => REPRESENTATIVE_SCREENS.has(name));
  for (const screen of screens) {
    test(`${screen.name} remains fluid at ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport, hasTouch: viewport.width < 768 });
      const page = await context.newPage();
      await page.clock.install();
      await screen.open(page);
      await expectFluidLayout(page, screen, viewport.name);
      await context.close();
    });
  }
}

test("page gutters and vertical rhythm scale continuously from the root contract", async ({ page }) => {
  const inlinePaddings: number[] = [];
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    inlinePaddings.push(
      await page
        .locator("main[data-layout-shell]")
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingInlineStart)),
    );
  }
  expect(inlinePaddings[0]).toBeLessThan(inlinePaddings[1]);
  expect(inlinePaddings[1]).toBeLessThan(inlinePaddings[2]);

  const blockPaddings: number[] = [];
  for (const height of [375, 900]) {
    await page.setViewportSize({ width: 768, height });
    await page.goto("/");
    await page.getByRole("button", { name: "表示設定" }).click();
    blockPaddings.push(
      await page
        .locator("main[data-layout-shell]")
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBlockStart)),
    );
  }
  expect(blockPaddings[0]).toBeLessThan(blockPaddings[1]);
});

test("the centered loading shell keeps the same fluid contract", async ({ browser }) => {
  const context = await browser.newContext({ viewport: VIEWPORTS[0], hasTouch: true });
  const page = await context.newPage();
  await page.goto("/");

  let releaseChunk: () => void = () => {};
  const chunkGate = new Promise<void>((resolve) => {
    releaseChunk = resolve;
  });
  await page.route("**/_next/static/chunks/*", async (route) => {
    await chunkGate;
    await route.continue();
  });

  try {
    await page.getByRole("button", { name: /コンサル実務辞典を開く/ }).click();
    const loadingShell = page.locator("main.playbook-loading");
    await expect(loadingShell).toHaveAttribute("data-layout-shell", "wide");
    await expect(loadingShell).toHaveCSS("display", "grid");
  } finally {
    releaseChunk();
    await page.unrouteAll({ behavior: "wait" });
    await context.close();
  }
});
