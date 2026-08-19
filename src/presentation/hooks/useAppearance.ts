"use client";

import { useEffect } from "react";
import type { AppearanceSettings } from "../../application/settings/app-settings.ts";
import { applyAppearance } from "../theme/apply-appearance.ts";

/**
 * Keep the document root in step with appearance chosen during this session.
 *
 * The first paint already carries the stored values because the server rendered them
 * from the cookie, so this exists for changes made afterwards. Re-applying identical
 * values on mount is a no-op, which is why there is no "ready" guard.
 */
export function useAppearance(appearance: AppearanceSettings): void {
  useEffect(() => {
    applyAppearance(document.documentElement, appearance);
  }, [appearance]);
}
