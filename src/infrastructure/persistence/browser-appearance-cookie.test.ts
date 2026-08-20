import assert from "node:assert/strict";
import test from "node:test";
import { readAppearanceCookie } from "./browser-appearance-cookie.ts";

test("browser appearance reader finds and validates the shared cookie", () => {
  assert.deepEqual(readAppearanceCookie("other=1; typeloop-appearance=modern.compact.reduced; final=2"), {
    themeId: "modern",
    density: "compact",
    motion: "reduced",
  });
  assert.deepEqual(readAppearanceCookie("typeloop-appearance=unknown.spacious.fast"), {
    themeId: "noir",
    density: "comfortable",
    motion: "system",
  });
});
