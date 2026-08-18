import assert from "node:assert/strict";
import test from "node:test";
import { isKeyboardOpen, keyboardInsetFrom, KEYBOARD_INSET_THRESHOLD_PX } from "./keyboard-inset.ts";

test("reports no inset while the visual viewport matches the layout viewport", () => {
  assert.equal(keyboardInsetFrom({ layoutHeight: 844, visualHeight: 844, offsetTop: 0 }), 0);
  assert.equal(isKeyboardOpen({ layoutHeight: 844, visualHeight: 844, offsetTop: 0 }), false);
});

test("ignores small visual viewport changes from collapsing browser chrome", () => {
  const chromeShift = KEYBOARD_INSET_THRESHOLD_PX - 1;
  assert.equal(keyboardInsetFrom({ layoutHeight: 844, visualHeight: 844 - chromeShift, offsetTop: 0 }), 0);
});

test("reports the hidden height once a keyboard is open", () => {
  assert.equal(keyboardInsetFrom({ layoutHeight: 844, visualHeight: 508, offsetTop: 0 }), 336);
  assert.equal(isKeyboardOpen({ layoutHeight: 844, visualHeight: 508, offsetTop: 0 }), true);
});

test("subtracts the visual viewport scroll offset so a scrolled page is not double counted", () => {
  assert.equal(keyboardInsetFrom({ layoutHeight: 844, visualHeight: 508, offsetTop: 100 }), 236);
  assert.equal(keyboardInsetFrom({ layoutHeight: 844, visualHeight: 508, offsetTop: 320 }), 0);
});

test("never reports more than the layout viewport and tolerates missing measurements", () => {
  assert.equal(keyboardInsetFrom({ layoutHeight: 400, visualHeight: 0, offsetTop: 0 }), 400);
  assert.equal(keyboardInsetFrom({ layoutHeight: Number.NaN, visualHeight: 508, offsetTop: 0 }), 0);
});
