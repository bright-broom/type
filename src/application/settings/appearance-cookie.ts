import {
  DEFAULT_APPEARANCE,
  DISPLAY_DENSITIES,
  MOTION_PREFERENCES,
  THEME_IDS,
  type AppearanceSettings,
} from "./app-settings.ts";

/**
 * Appearance is the one preference the delivery shell must know before it paints.
 *
 * Session history and sound live in localStorage. Appearance uses a cookie because a
 * parser-blocking, same-origin bootstrap can validate it during HTML parsing, before
 * application paint. localStorage no longer holds a copy: one owner per preference,
 * never two (see ADR-023).
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

/** Safe authored defaults and runtime attributes share one closed CSS selector contract. */
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
