import assert from "node:assert/strict";
import test from "node:test";
import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import { createTypingState } from "../../domain/typing/romanization-engine.ts";
import { applyTypingText } from "./apply-typing-text.ts";

function prompt(id: string, reading: string): TypingPrompt {
  return { id, reading, displayText: reading, category: "basic", difficulty: 1 };
}

test("applies every character in one mobile input event against the latest typing state", () => {
  const current = prompt("current", "とまと");
  const next = prompt("next", "なす");
  const applied = applyTypingText(current, createTypingState(current.reading), "to", () => next);

  assert.equal(applied.steps.length, 2);
  assert.equal(
    applied.steps.every((step) => step.result.accepted),
    true,
  );
  assert.equal(applied.typing.input, "to");
  assert.equal(applied.prompt, current);
});

test("continues the same batch on the next prompt after completion", () => {
  const current = prompt("current", "と");
  const next = prompt("next", "なす");
  const applied = applyTypingText(current, createTypingState(current.reading), "tona", () => next);

  assert.equal(applied.steps.length, 4);
  assert.equal(applied.steps[1]?.nextPrompt, next);
  assert.equal(applied.prompt, next);
  assert.equal(applied.typing.input, "na");
});
