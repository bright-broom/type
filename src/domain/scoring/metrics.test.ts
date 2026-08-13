import assert from "node:assert/strict";
import test from "node:test";
import { calculateMetrics } from "./metrics.ts";

test("zero time and zero keystrokes stay finite", () => {
  const metrics = calculateMetrics({ correct: 0, incorrect: 0, elapsedMs: 0 });
  assert.deepEqual(metrics, {
    correctKeystrokes: 0,
    totalKeystrokes: 0,
    accuracy: 100,
    wpm: 0,
    cpm: 0,
    elapsedMs: 0,
  });
});

test("calculates canonical metrics at 60 seconds", () => {
  const metrics = calculateMetrics({ correct: 250, incorrect: 10, elapsedMs: 60_000 });
  assert.equal(metrics.wpm, 50);
  assert.equal(metrics.cpm, 250);
  assert.equal(metrics.accuracy, 96.15);
});

test("handles one second and all incorrect input", () => {
  const fast = calculateMetrics({ correct: 5, incorrect: 0, elapsedMs: 1_000 });
  assert.equal(fast.wpm, 60);
  assert.equal(fast.accuracy, 100);
  const missed = calculateMetrics({ correct: 0, incorrect: 5, elapsedMs: 1_000 });
  assert.equal(missed.wpm, 0);
  assert.equal(missed.accuracy, 0);
});
