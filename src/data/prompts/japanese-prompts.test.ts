import assert from "node:assert/strict";
import test from "node:test";
import { JAPANESE_PROMPTS } from "./japanese-prompts.ts";
import { validatePrompts } from "./validate-prompts.ts";

test("prompt dataset is valid and covers the intended distribution", () => {
  assert.deepEqual(validatePrompts(JAPANESE_PROMPTS), []);
  assert.ok(JAPANESE_PROMPTS.length >= 40);
  assert.deepEqual(new Set(JAPANESE_PROMPTS.map((prompt) => prompt.difficulty)), new Set([1, 2, 3, 4, 5]));
});
