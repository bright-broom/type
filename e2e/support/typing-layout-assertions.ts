import { expect, type Page } from "@playwright/test";

export const TYPING_VIEWPORTS = [
  { name: "compact-phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone-landscape", width: 667, height: 375 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

export const CRITICAL_TYPING_VIEWPORTS = [TYPING_VIEWPORTS[0], TYPING_VIEWPORTS[2], TYPING_VIEWPORTS[5]];

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}

export async function expectHomeActionsNotClipped(page: Page, viewportName: string): Promise<void> {
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main a[href], main label[data-mode-option]")]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
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
