import {
  DEFAULT_APPEARANCE,
  DISPLAY_DENSITIES,
  MOTION_PREFERENCES,
  THEME_IDS,
  type AppearanceSettings,
} from "./app-settings.ts";

/**
 * Appearance is the one preference the server must know before it renders.
 *
 * Session history and sound live in localStorage, which the server cannot read, so
 * a persisted theme could only be restored by a client script — and that script runs
 * after the first paint, flashing the default theme (measured; see ADR-014). A cookie
 * is the only store both sides can see, so appearance moved here and localStorage no
 * longer holds a copy: one owner per preference, never two.
 *
 * The value is three allow-listed identifiers, dot separated. Deliberately not JSON:
 * cookies would need escaping, and a fixed triple cannot grow an injection surface.
 */
export const APPEARANCE_COOKIE = "typeloop-appearance";

/** A year: long enough that a display choice survives, short enough to expire. */
export const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function serializeAppearance(appearance: AppearanceSettings): string {
  return [appearance.themeId, appearance.density, appearance.motion].join(".");
}

function pick<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Read a cookie value into appearance, falling back per field.
 *
 * Anything unrecognised — a stale format, a truncated value, a hand-edited cookie —
 * yields defaults for the fields it cannot explain rather than rejecting the whole
 * value, so one bad field never resets the others.
 */
export function parseAppearance(raw: string | undefined | null): AppearanceSettings {
  const [themeId, density, motion] = (raw ?? "").split(".");
  return {
    themeId: pick(THEME_IDS, themeId, DEFAULT_APPEARANCE.themeId),
    density: pick(DISPLAY_DENSITIES, density, DEFAULT_APPEARANCE.density),
    motion: pick(MOTION_PREFERENCES, motion, DEFAULT_APPEARANCE.motion),
  };
}

/** Attributes the document root carries so CSS can select a theme without JavaScript. */
export function appearanceDataAttributes(appearance: AppearanceSettings): {
  "data-theme": string;
  "data-density": string;
  "data-motion": string;
} {
  return {
    "data-theme": appearance.themeId,
    "data-density": appearance.density,
    "data-motion": appearance.motion,
  };
}
