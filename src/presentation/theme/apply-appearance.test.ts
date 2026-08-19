import assert from "node:assert/strict";
import test from "node:test";
import { applyAppearance } from "./apply-appearance.ts";

test("applies each appearance axis to the document root contract", () => {
  const root = { dataset: {} } as unknown as HTMLElement;
  applyAppearance(root, { themeId: "classic", density: "compact", motion: "reduced" });
  assert.deepEqual(root.dataset, { theme: "classic", density: "compact", motion: "reduced" });
});
