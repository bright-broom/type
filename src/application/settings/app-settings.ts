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

export type AppSettings = {
  soundEnabled: boolean;
  appearance: AppearanceSettings;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: "modern",
  density: "comfortable",
  motion: "system",
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  soundEnabled: true,
  appearance: DEFAULT_APPEARANCE,
};

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function normalizeAppSettings(value: unknown): AppSettings {
  const settings = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const appearance =
    settings.appearance && typeof settings.appearance === "object"
      ? (settings.appearance as Record<string, unknown>)
      : {};

  return {
    soundEnabled:
      typeof settings.soundEnabled === "boolean" ? settings.soundEnabled : DEFAULT_APP_SETTINGS.soundEnabled,
    appearance: {
      themeId: includes(THEME_IDS, appearance.themeId) ? appearance.themeId : DEFAULT_APPEARANCE.themeId,
      density: includes(DISPLAY_DENSITIES, appearance.density) ? appearance.density : DEFAULT_APPEARANCE.density,
      motion: includes(MOTION_PREFERENCES, appearance.motion) ? appearance.motion : DEFAULT_APPEARANCE.motion,
    },
  };
}
