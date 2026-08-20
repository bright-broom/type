import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "./app-settings.ts";

test("keeps a stored sound preference and defaults anything else", () => {
  assert.deepEqual(normalizeAppSettings({ soundEnabled: false }), { soundEnabled: false });
  assert.deepEqual(normalizeAppSettings({ soundEnabled: true }), { soundEnabled: true });
  assert.deepEqual(normalizeAppSettings({}), DEFAULT_APP_SETTINGS);
});

test("a non-boolean sound value falls back instead of leaking through", () => {
  for (const soundEnabled of ["true", 1, null, {}]) {
    assert.deepEqual(normalizeAppSettings({ soundEnabled }), DEFAULT_APP_SETTINGS);
  }
});

test("an appearance left in storage is dropped rather than carried forward", () => {
  // Appearance moved to a cookie so the pre-paint shell can read it. Copying a stale localStorage
  // copy forward is exactly how the two stores would drift apart.
  const settings = normalizeAppSettings({
    soundEnabled: false,
    appearance: { themeId: "classic", density: "compact", motion: "reduced" },
  });
  assert.deepEqual(settings, { soundEnabled: false });
});

test("unusable payloads produce the documented defaults", () => {
  for (const payload of [null, undefined, 42, "settings", []]) {
    assert.deepEqual(normalizeAppSettings(payload), DEFAULT_APP_SETTINGS);
  }
});
