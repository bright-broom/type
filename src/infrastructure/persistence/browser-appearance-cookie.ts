import {
  APPEARANCE_COOKIE,
  APPEARANCE_COOKIE_MAX_AGE_SECONDS,
  serializeAppearance,
} from "../../application/settings/appearance-cookie.ts";
import type { AppearanceSettings } from "../../application/settings/app-settings.ts";

/**
 * Persist appearance where the server can read it on the next request.
 *
 * `SameSite=Lax` because the cookie is only ever read by this origin's own document
 * request; it is not `HttpOnly` because the settings screen writes it directly, and
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
