import assert from "node:assert/strict";
import test from "node:test";
import { OVERLAY_PATH, overlayFromPathname, returnFocusKeyFromState } from "./reference-route.ts";

test("every reference surface has one stable path", () => {
  assert.deepEqual(OVERLAY_PATH, {
    none: "/",
    history: "/history",
    playbook: "/consulting",
    takken: "/takken/glossary",
    ais: "/ais",
    settings: "/settings",
  });
  for (const [overlay, pathname] of Object.entries(OVERLAY_PATH)) {
    assert.equal(overlayFromPathname(pathname), overlay);
  }
  assert.equal(overlayFromPathname("/unknown"), "none");
});

test("focus restoration accepts only a string key", () => {
  assert.equal(returnFocusKeyFromState({ typeloopReturnFocusKey: "header-settings" }), "header-settings");
  assert.equal(returnFocusKeyFromState({ typeloopReturnFocusKey: 42 }), null);
  assert.equal(returnFocusKeyFromState(null), null);
});
