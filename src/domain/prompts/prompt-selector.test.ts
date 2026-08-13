import assert from "node:assert/strict";
import test from "node:test";
import { createPromptSelector } from "./prompt-selector.ts";

const prompts = [
  { id: "a", displayText: "A", reading: "あ", category: "basic" as const, difficulty: 1 },
  { id: "b", displayText: "B", reading: "い", category: "basic" as const, difficulty: 1 },
  { id: "c", displayText: "C", reading: "う", category: "basic" as const, difficulty: 1 },
];

test("shuffle bag emits every prompt before repeating", () => {
  const selector = createPromptSelector(prompts, () => 0.25);
  const firstBag = [selector.next(), selector.next(), selector.next()];
  assert.equal(new Set(firstBag.map((prompt) => prompt.id)).size, 3);
  assert.notEqual(selector.next().id, firstBag[2]?.id);
});
