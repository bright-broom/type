"use client";

import { useEffect } from "react";
import type { AppearanceSettings } from "../../application/settings/app-settings.ts";
import { applyAppearance } from "../theme/apply-appearance.ts";

export function useAppearance(appearance: AppearanceSettings, settingsReady: boolean): void {
  useEffect(() => {
    if (!settingsReady) return;
    applyAppearance(document.documentElement, appearance);
  }, [appearance, settingsReady]);
}
