import { expect, type Page } from "@playwright/test";

export type ShellWidth = "wide" | "default" | "reading" | "assessment" | "session" | "game" | "compact";
export type LayoutScreen = { name: string; width: ShellWidth; open: (page: Page) => Promise<void> };

export async function expectFluidLayout(page: Page, screen: LayoutScreen, viewportName: string): Promise<void> {
  const shell = page.locator("main[data-layout-shell]");
  await expect(shell).toHaveCount(1);
  await expect(shell).toHaveAttribute("data-layout-shell", screen.width);

  const audit = await shell.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const clippedActions = [...document.querySelectorAll("button, a[href], label, input, select")]
      .filter((action) => {
        const box = action.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;

        // An action may intentionally sit beyond the current viewport inside a
        // horizontal rail. Only user-scrollable overflow makes it reachable.
        let hasHorizontalScroller = false;
        for (let ancestor = action.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const ancestorStyle = getComputedStyle(ancestor);
          if (
            (ancestorStyle.overflowX === "auto" || ancestorStyle.overflowX === "scroll") &&
            ancestor.scrollWidth > ancestor.clientWidth + 1
          ) {
            hasHorizontalScroller = true;
            break;
          }
        }

        return (
          (!hasHorizontalScroller && (box.left < -1 || box.right > window.innerWidth + 1)) ||
          action.scrollWidth > action.clientWidth + 1 ||
          action.scrollHeight > action.clientHeight + 1
        );
      })
      .map((action) => {
        const box = action.getBoundingClientRect();
        return {
          label: (action.getAttribute("aria-label") ?? action.textContent ?? action.tagName).trim().slice(0, 80),
          box: [Math.round(box.left), Math.round(box.right), Math.round(box.width), Math.round(box.height)],
          client: [action.clientWidth, action.clientHeight],
          scroll: [action.scrollWidth, action.scrollHeight],
        };
      });
    return {
      rect: { left: rect.left, right: rect.right, width: rect.width },
      paddingInline: [Number.parseFloat(style.paddingInlineStart), Number.parseFloat(style.paddingInlineEnd)],
      container: [style.containerName, style.containerType],
      clippedActions,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(audit.rect.left, `${viewportName} / ${screen.name} starts outside the viewport`).toBeGreaterThanOrEqual(-1);
  expect(audit.rect.right, `${viewportName} / ${screen.name} ends outside the viewport`).toBeLessThanOrEqual(
    audit.viewportWidth + 1,
  );
  expect(audit.documentWidth, `${viewportName} / ${screen.name} has horizontal overflow`).toBeLessThanOrEqual(
    audit.viewportWidth + 1,
  );
  expect(audit.paddingInline.every((value) => value >= 14)).toBe(true);
  expect(audit.container).toEqual(["page-shell", "inline-size"]);
  expect(audit.clippedActions, `${viewportName} / ${screen.name} clips an action`).toEqual([]);

  const rail = page.locator("[data-horizontal-rail]");
  if ((await rail.count()) === 0) return;
  const reachability = await rail.evaluate((element) => {
    if (element.scrollWidth <= element.clientWidth + 1) return null;
    element.scrollLeft = element.scrollWidth;
    const railRect = element.getBoundingClientRect();
    const lastActionRect = element.querySelector("button:last-child")?.getBoundingClientRect();
    return {
      overflowX: getComputedStyle(element).overflowX,
      lastActionVisible:
        lastActionRect !== undefined &&
        lastActionRect.left >= railRect.left - 1 &&
        lastActionRect.right <= railRect.right + 1,
    };
  });
  if (!reachability) return;
  expect(["auto", "scroll"]).toContain(reachability.overflowX);
  expect(reachability.lastActionVisible, `${viewportName} / ${screen.name} rail is not reachable`).toBe(true);
}
