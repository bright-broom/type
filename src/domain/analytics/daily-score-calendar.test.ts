import assert from "node:assert/strict";
import test from "node:test";
import {
  addDailyScore,
  collectDailyScores,
  isDailyScore,
  localDateKey,
  summarizeDailyScores,
  type DailyScore,
} from "./daily-score-calendar.ts";

test("groups sessions by local calendar day and keeps the daily best", () => {
  const morning = new Date(2026, 7, 12, 8, 30).getTime();
  const evening = new Date(2026, 7, 12, 21, 15).getTime();
  const nextDay = new Date(2026, 7, 13, 0, 5).getTime();

  const scores = collectDailyScores(
    [
      { endedAt: morning, score: 1_200 },
      { endedAt: evening, score: 1_850 },
      { endedAt: nextDay, score: 900 },
    ],
    2026,
    7,
  );

  assert.deepEqual(scores.get("2026-08-12"), {
    dateKey: "2026-08-12",
    day: 12,
    bestScore: 1_850,
    sessionCount: 2,
  });
  assert.equal(scores.get("2026-08-13")?.bestScore, 900);
});

test("keeps a stable daily summary after detailed sessions are discarded", () => {
  const first = { endedAt: new Date(2026, 7, 12, 8).getTime(), score: 1_200 };
  const second = { endedAt: new Date(2026, 7, 12, 18).getTime(), score: 1_800 };
  const summaries = addDailyScore(addDailyScore([], first), second);

  assert.deepEqual(summaries, [{ dateKey: "2026-08-12", day: 12, bestScore: 1_800, sessionCount: 2 }]);
  assert.deepEqual(summarizeDailyScores([first, second]), summaries);
  assert.equal(isDailyScore(summaries[0]), true);
  assert.equal(isDailyScore({ ...summaries[0], sessionCount: 0 }), false);
});

test("preserves fields written by a future daily summary version", () => {
  const future = {
    dateKey: "2026-08-12",
    day: 12,
    bestScore: 100,
    sessionCount: 1,
    futureMetric: 7,
  } as DailyScore & { futureMetric: number };
  const updated = addDailyScore([future], {
    endedAt: new Date(2026, 7, 12, 18).getTime(),
    score: 200,
  })[0] as DailyScore & { futureMetric?: number };

  assert.equal(updated.futureMetric, 7);
  assert.equal(updated.bestScore, 200);
  assert.equal(updated.sessionCount, 2);
});

test("excludes other months and unusable persisted values", () => {
  const scores = collectDailyScores(
    [
      { endedAt: new Date(2026, 6, 31, 23, 59).getTime(), score: 999 },
      { endedAt: Number.NaN, score: 1_000 },
      { endedAt: new Date(2026, 7, 1).getTime(), score: Number.NaN },
    ],
    2026,
    7,
  );

  assert.equal(scores.size, 0);
  assert.equal(localDateKey(Number.NaN), null);
});
