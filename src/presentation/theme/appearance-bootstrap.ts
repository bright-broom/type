import {
  DEFAULT_APPEARANCE,
  DISPLAY_DENSITIES,
  MOTION_PREFERENCES,
  THEME_IDS,
} from "../../application/settings/app-settings.ts";
import { STORAGE_KEY } from "../../infrastructure/persistence/local-session-repository.ts";

/**
 * Runs before hydration so a persisted theme never flashes as the default theme.
 * Every interpolated value comes from an authored allow-list; stored data is only
 * selected when it matches one of those values.
 */
export const APPEARANCE_BOOTSTRAP_SCRIPT = `(()=>{try{const p=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})||"null");const a=p&&p.settings&&p.settings.appearance||{};const pick=(v,allowed,fallback)=>allowed.includes(v)?v:fallback;const r=document.documentElement;r.dataset.theme=pick(a.themeId,${JSON.stringify(
  THEME_IDS,
)},${JSON.stringify(DEFAULT_APPEARANCE.themeId)});r.dataset.density=pick(a.density,${JSON.stringify(
  DISPLAY_DENSITIES,
)},${JSON.stringify(DEFAULT_APPEARANCE.density)});r.dataset.motion=pick(a.motion,${JSON.stringify(
  MOTION_PREFERENCES,
)},${JSON.stringify(DEFAULT_APPEARANCE.motion)})}catch{}})();`;
