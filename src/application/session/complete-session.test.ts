import assert from "node:assert/strict";
import test from "node:test";
import { calculateScore } from "../../domain/scoring/scoring-engine.ts";
import { completeSession, type SessionOutcome } from "./complete-session.ts";

const metrics = { correctKeystrokes: 145, totalKeystrokes: 150, accuracy: 96.5, wpm: 30, cpm: 150, elapsedMs: 60_000 };

function outcome(overrides: Partial<SessionOutcome> = {}): SessionOutcome {
  return {
    id: "session-1",
    trainingSet: "japanese",
    startedAt: 1_000,
    endedAt: 61_000,
    attempts: [{ promptId: "p1", startedAt: 1_000, input: "sushi", correctKeystrokes: 5, incorrectKeystrokes: 0 }],
    keystrokes: [{ timestamp: 5, key: "s", normalizedKey: "s", correct: true, promptId: "p1", position: 0 }],
    metrics,
    completedPrompts: 4,
    maxCombo: 22,
    weakKeys: [{ key: "n", total: 6, correct: 4, incorrect: 2, accuracy: 66.67 }],
    ...overrides,
  };
}

test("carries the session through unchanged and derives the score", () => {
  const session = completeSession(outcome());
  assert.equal(session.id, "session-1");
  assert.equal(session.mode, "60s");
  assert.equal(session.trainingSet, "japanese");
  assert.equal(session.startedAt, 1_000);
  assert.equal(session.endedAt, 61_000);
  assert.equal(session.completedPrompts, 4);
  assert.equal(session.maxCombo, 22);
  assert.deepEqual(session.metrics, metrics);
  assert.equal(session.score, calculateScore({ ...metrics, completedPrompts: 4, maxCombo: 22 }));
});

test("persists only the documented record shape", () => {
  const session = completeSession(outcome());
  assert.deepEqual(Object.keys(session).sort(), [
    "completedPrompts",
    "endedAt",
    "id",
    "keystrokes",
    "maxCombo",
    "metrics",
    "mode",
    "prompts",
    "score",
    "startedAt",
    "trainingSet",
    "weakKeys",
  ]);
});

test("copies the mutable attempt and keystroke buffers", () => {
  const attempts = [{ promptId: "p1", startedAt: 0, input: "a", correctKeystrokes: 1, incorrectKeystrokes: 0 }];
  const session = completeSession(outcome({ attempts }));
  attempts.push({ promptId: "p2", startedAt: 1, input: "b", correctKeystrokes: 1, incorrectKeystrokes: 0 });
  assert.equal(session.prompts.length, 1);
});

test("an empty session still produces a persistable record", () => {
  const empty = { correctKeystrokes: 0, totalKeystrokes: 0, accuracy: 100, wpm: 0, cpm: 0, elapsedMs: 0 };
  const session = completeSession(
    outcome({ attempts: [], keystrokes: [], metrics: empty, completedPrompts: 0, maxCombo: 0, weakKeys: [] }),
  );
  assert.deepEqual(session.prompts, []);
  assert.equal(Number.isFinite(session.score), true);
});
