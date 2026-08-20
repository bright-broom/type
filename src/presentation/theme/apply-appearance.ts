import type { AppearanceSettings } from "../../application/settings/app-settings.ts";

export function applyAppearance(root: HTMLElement, appearance: AppearanceSettings): void {
  root.dataset.theme = appearance.themeId;
  root.dataset.density = appearance.density;
  root.dataset.motion = appearance.motion;
  const dark = appearance.themeId === "noir";
  root.style.colorScheme = dark ? "dark" : "light";
  const paper = root.ownerDocument?.defaultView?.getComputedStyle(root).getPropertyValue("--paper").trim();
  if (paper) {
    for (const themeColor of root.ownerDocument?.querySelectorAll('meta[name="theme-color"]') ?? []) {
      themeColor.setAttribute("content", paper);
    }
  }
}
