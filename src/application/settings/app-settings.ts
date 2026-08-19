export const THEME_IDS = ["modern", "classic"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DISPLAY_DENSITIES = ["comfortable", "compact"] as const;
export type DisplayDensity = (typeof DISPLAY_DENSITIES)[number];

export const MOTION_PREFERENCES = ["system", "reduced"] as const;
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];

export type AppearanceSettings = {
  themeId: ThemeId;
  density: DisplayDensity;
  motion: MotionPreference;
};

/**
 * Preferences the client alone needs. Appearance is deliberately absent: the server
 * must know it before it renders, so it lives in a cookie (`appearance-cookie.ts`).
 * Keeping a second copy here is what would let the two drift apart.
 */
export type AppSettings = {
  soundEnabled: boolean;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: "modern",
  density: "comfortable",
  motion: "system",
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  soundEnabled: true,
};

export function normalizeAppSettings(value: unknown): AppSettings {
  const settings = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    soundEnabled:
      typeof settings.soundEnabled === "boolean" ? settings.soundEnabled : DEFAULT_APP_SETTINGS.soundEnabled,
  };
}
