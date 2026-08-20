"use client";

import { useEffect } from "react";
import type { AppearanceSettings } from "../../application/settings/app-settings.ts";
import { applyAppearance } from "../theme/apply-appearance.ts";

/**
 * Keep the document root in step with appearance chosen during this session.
 *
 * The parser-blocking bootstrap owns first paint. The component hydrates from the
 * invariant default before its browser snapshot becomes available. While hydration
 * catches up, the bootstrap stays the only DOM owner so React cannot briefly restore
 * noir over a stored light/classic choice. This effect then owns in-session changes.
 */
export function useAppearance(appearance: AppearanceSettings, browserReady = true): void {
  useEffect(() => {
    if (!browserReady) return;
    applyAppearance(document.documentElement, appearance);
  }, [appearance, browserReady]);
}
