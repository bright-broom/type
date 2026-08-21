import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_APPEARANCE } from "./app-settings.ts";
import {
  APPEARANCE_COOKIE,
  appearanceDataAttributes,
  parseAppearance,
  serializeAppearance,
} from "./appearance-cookie.ts";

test("a serialized value round-trips", () => {
  const appearance = { themeId: "classic", density: "compact", motion: "reduced" } as const;
  assert.equal(serializeAppearance(appearance), "classic.compact.reduced");
  assert.deepEqual(parseAppearance(serializeAppearance(appearance)), appearance);
  assert.deepEqual(parseAppearance(serializeAppearance(DEFAULT_APPEARANCE)), DEFAULT_APPEARANCE);
});

test("noir is the default appearance and round-trips as an allow-listed theme", () => {
  const appearance = { ...DEFAULT_APPEARANCE, themeId: "noir" } as const;
  assert.equal(DEFAULT_APPEARANCE.themeId, "noir");
  assert.deepEqual(parseAppearance(serializeAppearance(appearance)), appearance);
});

test("each field falls back on its own, so one bad field keeps the others", () => {
  assert.deepEqual(parseAppearance("classic.nonsense.reduced"), {
    themeId: "classic",
    density: DEFAULT_APPEARANCE.density,
    motion: "reduced",
  });
  assert.deepEqual(parseAppearance("nope.compact.nope"), {
    themeId: DEFAULT_APPEARANCE.themeId,
    density: "compact",
    motion: DEFAULT_APPEARANCE.motion,
  });
});

test("a missing, empty, or hand-edited cookie yields the defaults", () => {
  for (const raw of [undefined, null, "", "..", "classic", "a.b.c.d.e", "../evil.compact.reduced"]) {
    const appearance = parseAppearance(raw);
    assert.ok(["noir", "modern", "classic"].includes(appearance.themeId), `themeId escaped for ${JSON.stringify(raw)}`);
    assert.ok(["comfortable", "compact"].includes(appearance.density));
    assert.ok(["system", "reduced"].includes(appearance.motion));
  }
  assert.deepEqual(parseAppearance(""), DEFAULT_APPEARANCE);
});

test("only allow-listed identifiers can reach the document attributes", () => {
  // These attribute values reach the document root, so nothing unvalidated may
  // pass through. The dot-separated format also cannot carry quotes or semicolons.
  const attributes = appearanceDataAttributes(parseAppearance('classic."><script>.reduced'));
  assert.deepEqual(attributes, {
    "data-theme": "classic",
    "data-density": DEFAULT_APPEARANCE.density,
    "data-motion": "reduced",
  });
  for (const value of Object.values(attributes)) assert.match(value, /^[a-z]+$/);
});

test("the cookie name is stable", () => {
  // The parser-blocking bootstrap reads this name before application paint; renaming it silently
  // resets everyone's theme.
  assert.equal(APPEARANCE_COOKIE, "typeloop-appearance");
});
