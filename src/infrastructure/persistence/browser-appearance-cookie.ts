import {
  APPEARANCE_COOKIE,
  APPEARANCE_COOKIE_MAX_AGE_SECONDS,
  serializeAppearance,
} from "../../application/settings/appearance-cookie.ts";
import type { AppearanceSettings } from "../../application/settings/app-settings.ts";
import { parseAppearance } from "../../application/settings/appearance-cookie.ts";

export function readAppearanceCookie(
  cookie = typeof document === "undefined" ? "" : document.cookie,
): AppearanceSettings {
  const prefix = `${APPEARANCE_COOKIE}=`;
  const raw = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return parseAppearance(raw);
}

/**
 * Persist appearance where the pre-paint bootstrap can read it on the next navigation.
 *
 * `SameSite=Lax` because the cookie is only ever read by this origin's own document;
 * it is not `HttpOnly` because the settings screen and bootstrap read it directly, and
 * not `Secure` in development so localhost keeps working. It carries three
 * allow-listed identifiers and no personal data.
 */
export function writeAppearanceCookie(appearance: AppearanceSettings): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${APPEARANCE_COOKIE}=${serializeAppearance(appearance)}` +
    `; Path=/; Max-Age=${APPEARANCE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
