import assert from "node:assert/strict";
import test from "node:test";
import { createAssessmentAttempt } from "./assessment-attempt.ts";
import { assessmentAttemptTransition } from "./assessment-reducer.ts";

function attempt(durationMs: number | null = 1_000) {
  return createAssessmentAttempt({
    id: "attempt-1",
    packVersion: "2026.1",
    mode: durationMs === null ? "practice" : "mock-standard",
    questionIds: ["q1", "q2"],
    startedAt: 1_000,
    durationMs,
  });
}

test("records answers, navigation, and flags only while active", () => {
  let state = assessmentAttemptTransition(attempt(), { type: "ANSWER", questionId: "q1", choiceId: "3", now: 1_100 });
  state = assessmentAttemptTransition(state, { type: "NAVIGATE", index: 1, now: 1_200 });
  state = assessmentAttemptTransition(state, { type: "TOGGLE_FLAG", questionId: "q2", now: 1_300 });
  assert.equal(state.answers.q1.choiceId, "3");
  assert.equal(state.currentIndex, 1);
  assert.deepEqual(state.flaggedQuestionIds, ["q2"]);

  const submitted = assessmentAttemptTransition(state, { type: "SUBMIT", now: 1_500 });
  assert.strictEqual(
    assessmentAttemptTransition(submitted, { type: "ANSWER", questionId: "q2", choiceId: "1", now: 1_600 }),
    submitted,
  );
});

test("uses a wall-clock deadline and expires at the stored deadline", () => {
  const state = attempt();
  assert.strictEqual(assessmentAttemptTransition(state, { type: "TICK", now: 1_999 }), state);
  assert.deepEqual(assessmentAttemptTransition(state, { type: "TICK", now: 2_001 }), {
    ...state,
    status: "expired",
    completedAt: 2_000,
  });
});

test("the deadline wins over every late user event without waiting for a timer tick", () => {
  const state = attempt();
  const events = [
    { type: "ANSWER", questionId: "q1", choiceId: "1", now: 2_000 },
    { type: "NAVIGATE", index: 1, now: 2_000 },
    { type: "TOGGLE_FLAG", questionId: "q1", now: 2_000 },
    { type: "SUBMIT", now: 2_000 },
    { type: "ABANDON", now: 2_000 },
  ] as const;
  for (const event of events) {
    assert.deepEqual(assessmentAttemptTransition(state, event), {
      ...state,
      status: "expired",
      completedAt: 2_000,
    });
  }
});

test("practice attempts have no deadline", () => {
  const state = attempt(null);
  assert.strictEqual(assessmentAttemptTransition(state, { type: "TICK", now: Number.MAX_SAFE_INTEGER }), state);
});
