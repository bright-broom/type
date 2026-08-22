import assert from "node:assert/strict";
import test from "node:test";
import type { CompletedSession } from "./session-types.ts";
import { hasDetailedTypingData, minimizeCompletedSession } from "./session-retention.ts";

const detailedSession: CompletedSession = {
  id: "session-private-input",
  mode: "60s",
  trainingSet: "japanese",
  startedAt: 1_000,
  endedAt: 61_000,
  prompts: [
    {
      promptId: "basic-1",
      startedAt: 1_000,
      input: "sensitive-typed-text",
      correctKeystrokes: 1,
      incorrectKeystrokes: 1,
    },
  ],
  keystrokes: [
    {
      timestamp: 1_001,
      key: "s",
      normalizedKey: "s",
      correct: true,
      promptId: "basic-1",
      position: 0,
    },
  ],
  metrics: { wpm: 1, cpm: 5, accuracy: 50, correctKeystrokes: 1, totalKeystrokes: 2, elapsedMs: 60_000 },
  score: 10,
  completedPrompts: 0,
  maxCombo: 1,
  weakKeys: [{ key: "x", total: 1, correct: 0, incorrect: 1, accuracy: 0 }],
};

test("retention removes reconstructable input while keeping derived guidance", () => {
  assert.equal(hasDetailedTypingData(detailedSession), true);
  const minimized = minimizeCompletedSession(detailedSession);
  assert.deepEqual(minimized.prompts, []);
  assert.deepEqual(minimized.keystrokes, []);
  assert.deepEqual(minimized.metrics, detailedSession.metrics);
  assert.deepEqual(minimized.weakKeys, detailedSession.weakKeys);
  assert.equal(hasDetailedTypingData(minimized), false);
});
