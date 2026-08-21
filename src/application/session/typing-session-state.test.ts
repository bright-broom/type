import assert from "node:assert/strict";
import test from "node:test";
import type { TypingPrompt } from "../../domain/prompts/prompt-types.ts";
import {
  alignTypingAttemptStart,
  completeTypingSession,
  createTypingAttempt,
  createTypingSessionState,
  transitionTypingText,
} from "./typing-session-state.ts";

const FIRST: TypingPrompt = { id: "first", displayText: "AB", reading: "ab", category: "basic", difficulty: 1 };
const SECOND: TypingPrompt = { id: "second", displayText: "CD", reading: "cd", category: "basic", difficulty: 1 };

test("a start creates one coherent typing state and attempt", () => {
  const state = createTypingSessionState(FIRST, "japanese");
  assert.equal(state.prompt.id, "first");
  assert.equal(state.typing.input, "");
  assert.equal(state.correct, 0);
  assert.equal(state.feedback, null);
  assert.deepEqual(createTypingAttempt(FIRST, 10), {
    promptId: "first",
    startedAt: 10,
    input: "",
    correctKeystrokes: 0,
    incorrectKeystrokes: 0,
  });
});

test("one text event updates prompt, counters, combo, and attempt atomically", () => {
  const state = createTypingSessionState(FIRST, "japanese");
  const transition = transitionTypingText({
    state,
    attempt: createTypingAttempt(FIRST, 10),
    text: "ab",
    selectNextPrompt: () => SECOND,
    now: () => 20,
  });
  assert.equal(transition.state.prompt.id, "second");
  assert.equal(transition.state.correct, 2);
  assert.equal(transition.state.combo, 2);
  assert.equal(transition.state.completedPrompts, 1);
  assert.equal(transition.tally?.attempt.promptId, "second");
  assert.deepEqual(transition.tally?.sounds, ["correct", "complete"]);
  assert.equal(state.correct, 0);
});

test("unsupported text explains itself without changing accuracy state", () => {
  const state = createTypingSessionState(FIRST, "japanese");
  const transition = transitionTypingText({
    state,
    attempt: createTypingAttempt(FIRST, 10),
    text: "あ",
    selectNextPrompt: () => SECOND,
    now: () => 20,
  });
  assert.equal(transition.state.feedback, "unsupported");
  assert.equal(transition.state.correct, 0);
  assert.equal(transition.state.misses, 0);
  assert.equal(transition.tally, null);
});

test("completion derives the persisted record from one session snapshot", () => {
  const state = { ...createTypingSessionState(FIRST, "consulting"), correct: 5, misses: 1, maxCombo: 4 };
  const session = completeTypingSession({
    id: "session-1",
    state,
    startedAt: 1_000,
    endedAt: 61_000,
    elapsedMs: 60_000,
    attempts: [],
    activeAttempt: { ...createTypingAttempt(FIRST, 1_000), input: "a", correctKeystrokes: 1 },
    keystrokes: [],
  });
  assert.equal(session.trainingSet, "consulting");
  assert.equal(session.metrics.correctKeystrokes, 5);
  assert.equal(session.metrics.totalKeystrokes, 6);
  assert.equal(session.maxCombo, 4);
  assert.equal(session.prompts.length, 1);
});

test("countdown alignment preserves an attempt that already received input", () => {
  const fresh = createTypingAttempt(FIRST, 10);
  assert.equal(alignTypingAttemptStart(fresh, 20)?.startedAt, 20);
  assert.equal(alignTypingAttemptStart({ ...fresh, input: "a" }, 20)?.startedAt, 10);
});
