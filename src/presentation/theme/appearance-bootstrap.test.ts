import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { APPEARANCE_BOOTSTRAP_SCRIPT } from "./appearance-bootstrap.ts";

function bootstrap(payload: unknown) {
  const documentElement = { dataset: {} as Record<string, string> };
  vm.runInNewContext(APPEARANCE_BOOTSTRAP_SCRIPT, {
    document: { documentElement },
    localStorage: { getItem: () => JSON.stringify(payload) },
  });
  return documentElement.dataset;
}

test("restores a valid appearance before hydration", () => {
  assert.deepEqual(
    bootstrap({
      settings: { appearance: { themeId: "classic", density: "compact", motion: "reduced" } },
    }),
    { theme: "classic", density: "compact", motion: "reduced" },
  );
});

test("rejects unknown persisted appearance values", () => {
  assert.deepEqual(bootstrap({ settings: { appearance: { themeId: "remote-code", density: 12, motion: "spin" } } }), {
    theme: "modern",
    density: "comfortable",
    motion: "system",
  });
});
