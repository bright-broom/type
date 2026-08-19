import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "./app-settings.ts";

test("normalizes every appearance field independently", () => {
  assert.deepEqual(
    normalizeAppSettings({
      soundEnabled: false,
      appearance: { themeId: "classic", density: "compact", motion: "reduced" },
    }),
    {
      soundEnabled: false,
      appearance: { themeId: "classic", density: "compact", motion: "reduced" },
    },
  );
});

test("keeps valid fields when another persisted field is invalid", () => {
  assert.deepEqual(
    normalizeAppSettings({
      soundEnabled: false,
      appearance: { themeId: "unknown", density: "compact", motion: 42 },
    }),
    {
      soundEnabled: false,
      appearance: {
        themeId: DEFAULT_APP_SETTINGS.appearance.themeId,
        density: "compact",
        motion: DEFAULT_APP_SETTINGS.appearance.motion,
      },
    },
  );
});

test("upgrades sound-only settings without losing the preference", () => {
  const settings = normalizeAppSettings({ soundEnabled: false });
  assert.equal(settings.soundEnabled, false);
  assert.deepEqual(settings.appearance, DEFAULT_APP_SETTINGS.appearance);
});
