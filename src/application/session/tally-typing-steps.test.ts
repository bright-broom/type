import assert from "node:assert/strict";
import test from "node:test";
import { createTypingState } from "../../domain/typing/romanization-engine.ts";
import { applyTypingText } from "./apply-typing-text.ts";
import { tallyTypingSteps, type AttemptDraft } from "./tally-typing-steps.ts";

const sushi = { id: "p1", displayText: "すし", reading: "すし", category: "basic", difficulty: 1 } as const;
const neko = { id: "p2", displayText: "ねこ", reading: "ねこ", category: "basic", difficulty: 1 } as const;

function draft(promptId = sushi.id): AttemptDraft {
  return { promptId, startedAt: 0, input: "", correctKeystrokes: 0, incorrectKeystrokes: 0 };
}

/** Ticking clock so completion timestamps are assertable. */
function clock() {
  let value = 0;
  return () => (value += 10);
}

function tally(text: string, options: { combo?: number; maxCombo?: number } = {}) {
  const applied = applyTypingText(sushi, createTypingState(sushi.reading), text, () => neko);
  return {
    applied,
    result: tallyTypingSteps({
      steps: applied.steps,
      attempt: draft(),
      combo: options.combo ?? 0,
      maxCombo: options.maxCombo ?? 0,
      now: clock(),
    }),
  };
}

test("counts accepted keystrokes and grows the combo", () => {
  const { result } = tally("su");
  assert.equal(result.accepted, 2);
  assert.equal(result.missed, 0);
  assert.equal(result.combo, 2);
  assert.equal(result.maxCombo, 2);
  assert.equal(result.feedback, "correct");
  assert.deepEqual(result.sounds, ["correct", "correct"]);
});

test("a miss resets the combo but keeps the best combo reached", () => {
  const { result } = tally("sxu", { combo: 4, maxCombo: 9 });
  assert.equal(result.missed, 1);
  assert.equal(result.combo, 1, "the trailing accepted key restarts the combo");
  assert.equal(result.maxCombo, 9, "an earlier session peak is never lowered");
  assert.deepEqual(result.sounds, ["correct", "miss", "correct"]);
});

test("a rejected keystroke is logged but does not advance the input", () => {
  const { result } = tally("x");
  assert.equal(result.keystrokes.length, 1);
  assert.equal(result.keystrokes[0]?.correct, false);
  assert.equal(result.attempt.input, "");
  assert.equal(result.attempt.incorrectKeystrokes, 1);
  assert.equal(result.feedback, "miss");
});

test("completing a prompt records the attempt and starts the next one", () => {
  const { result } = tally("sushi");
  assert.equal(result.completed, 1);
  assert.equal(result.finishedAttempts.length, 1);
  const finished = result.finishedAttempts[0];
  assert.equal(finished?.promptId, sushi.id);
  assert.equal(finished?.correctKeystrokes, 5);
  assert.ok((finished?.completedAt ?? 0) > 0, "a finished attempt is timestamped");
  assert.equal(result.attempt.promptId, neko.id, "the in-progress attempt moves to the next prompt");
  assert.equal(result.attempt.input, "");
  assert.equal(result.attempt.correctKeystrokes, 0);
  assert.equal(result.feedback, "complete");
});

test("one burst of text can finish several prompts", () => {
  const applied = applyTypingText(sushi, createTypingState(sushi.reading), "sushineko", () => neko);
  const result = tallyTypingSteps({ steps: applied.steps, attempt: draft(), combo: 0, maxCombo: 0, now: clock() });
  assert.equal(result.completed, 2);
  assert.equal(result.finishedAttempts.length, 2);
  assert.deepEqual(
    result.finishedAttempts.map((attempt) => attempt.promptId),
    [sushi.id, neko.id],
  );
  assert.equal(result.combo, 9);
});

test("keystrokes carry the prompt and position they were typed against", () => {
  const { result } = tally("sus");
  assert.deepEqual(
    result.keystrokes.map((event) => [event.promptId, event.position, event.key]),
    [
      [sushi.id, 0, "s"],
      [sushi.id, 1, "u"],
      [sushi.id, 2, "s"],
    ],
  );
});

test("the incoming attempt is never mutated", () => {
  const attempt = draft();
  const applied = applyTypingText(sushi, createTypingState(sushi.reading), "su", () => neko);
  tallyTypingSteps({ steps: applied.steps, attempt, combo: 0, maxCombo: 0, now: clock() });
  assert.deepEqual(attempt, draft(), "callers keep their own copy until they adopt the result");
});

test("no steps means no change and no feedback", () => {
  const result = tallyTypingSteps({ steps: [], attempt: draft(), combo: 3, maxCombo: 7, now: clock() });
  assert.equal(result.feedback, null);
  assert.equal(result.combo, 3);
  assert.equal(result.maxCombo, 7);
  assert.deepEqual(result.keystrokes, []);
  assert.deepEqual(result.sounds, []);
});
