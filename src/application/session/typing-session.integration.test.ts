import assert from "node:assert/strict";
import test from "node:test";
import { calculateMetrics } from "../../domain/scoring/metrics.ts";
import { calculateScore } from "../../domain/scoring/scoring-engine.ts";
import { createTypingState, validateInput } from "../../domain/typing/romanization-engine.ts";

test("prompt input flows through matching, metrics, and result scoring", () => {
  const reading = "きって";
  let state = createTypingState(reading);
  let correct = 0;
  let incorrect = 0;
  for (const key of "kix tte".replace(" ", "")) {
    const outcome = validateInput(reading, state, key);
    if (outcome.accepted) {
      correct += 1;
      state = outcome.nextState;
    } else {
      incorrect += 1;
    }
  }
  assert.equal(state.completed, true);
  assert.equal(correct, 5);
  assert.equal(incorrect, 1);
  const metrics = calculateMetrics({ correct, incorrect, elapsedMs: 60_000 });
  assert.equal(metrics.accuracy, 83.33);
  assert.equal(calculateScore({ ...metrics, completedPrompts: 1, maxCombo: 3 }), 124);
});
