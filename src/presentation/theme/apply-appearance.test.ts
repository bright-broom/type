import assert from "node:assert/strict";
import test from "node:test";
import { applyAppearance } from "./apply-appearance.ts";

test("applies each appearance axis to the document root contract", () => {
  const writes: Array<[string, string]> = [];
  const root = {
    dataset: {},
    style: {},
    ownerDocument: {
      defaultView: { getComputedStyle: () => ({ getPropertyValue: () => " #f5f3ed " }) },
      querySelectorAll: () => [
        { setAttribute: (name: string, value: string) => writes.push([name, value]) },
        { setAttribute: (name: string, value: string) => writes.push([name, value]) },
      ],
    },
  } as unknown as HTMLElement;
  applyAppearance(root, { themeId: "classic", density: "compact", motion: "reduced" });
  assert.deepEqual(root.dataset, { theme: "classic", density: "compact", motion: "reduced" });
  assert.equal(root.style.colorScheme, "light");
  assert.deepEqual(writes, [
    ["content", "#f5f3ed"],
    ["content", "#f5f3ed"],
  ]);
});
