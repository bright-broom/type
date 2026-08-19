import type { AppearanceSettings } from "../../application/settings/app-settings.ts";

export function applyAppearance(root: HTMLElement, appearance: AppearanceSettings): void {
  root.dataset.theme = appearance.themeId;
  root.dataset.density = appearance.density;
  root.dataset.motion = appearance.motion;
}
