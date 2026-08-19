import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createAssessmentAttempt, type CompletedAssessment } from "../../application/assessment/assessment-attempt.ts";
import {
  ACTIVE_ASSESSMENT_KEY,
  ASSESSMENT_HISTORY_KEY,
  LocalAssessmentRepository,
} from "./local-assessment-repository.ts";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

function useStorage(storage: MemoryStorage) {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage } });
}

function completed(id: string, completedAt: number): CompletedAssessment {
  const questionIds = Array.from({ length: 10 }, (_, index) => `q${index + 1}`);
  return {
    ...createAssessmentAttempt({
      id,
      packVersion: "2026.1",
      mode: "practice",
      questionIds,
      startedAt: 1,
      durationMs: null,
    }),
    status: "submitted",
    completedAt,
    answers: { q1: { questionId: "q1", choiceId: "choice-1", answeredAt: completedAt } },
    score: {
      correct: 1,
      total: 10,
      unanswered: 9,
      accuracy: 10,
      results: questionIds.map((questionId, index) => ({
        questionId,
        choiceId: index === 0 ? "choice-1" : null,
        correctChoiceId: "choice-1",
        correct: index === 0,
        categoryId: "rights",
      })),
      categories: [{ id: "rights", label: "権利関係", correct: 1, total: 10 }],
    },
  };
}

afterEach(() => Reflect.deleteProperty(globalThis, "window"));

test("round-trips an active attempt and clears it independently from history", async () => {
  const memory = new MemoryStorage();
  useStorage(memory);
  const repository = new LocalAssessmentRepository();
  const active = createAssessmentAttempt({
    id: "active",
    packVersion: "2026.1",
    mode: "practice",
    questionIds: Array.from({ length: 10 }, (_, index) => `q${index + 1}`),
    startedAt: 10,
    durationMs: null,
  });
  await repository.saveActive(active);
  await repository.saveCompleted(completed("done", 2));
  assert.deepEqual(await repository.getActive(), active);
  await repository.clearActive();
  assert.equal(await repository.getActive(), null);
  assert.equal((await repository.getHistory()).length, 1);
});

test("salvages valid history, deduplicates ids, and caps records", async () => {
  const memory = new MemoryStorage();
  useStorage(memory);
  const repository = new LocalAssessmentRepository();
  for (let index = 0; index < 52; index += 1) await repository.saveCompleted(completed(`a${index}`, index));
  await repository.saveCompleted(completed("a51", 100));
  const history = await repository.getHistory();
  assert.equal(history.length, 50);
  assert.equal(history[0].completedAt, 100);
  assert.equal(history.filter(({ id }) => id === "a51").length, 1);

  memory.values.set(ASSESSMENT_HISTORY_KEY, JSON.stringify([null, { id: "bad" }, completed("safe", 1)]));
  assert.deepEqual(
    (await repository.getHistory()).map(({ id }) => id),
    ["safe"],
  );
});

test("corrupt or unavailable storage is non-fatal", async () => {
  const memory = new MemoryStorage();
  useStorage(memory);
  memory.values.set(ACTIVE_ASSESSMENT_KEY, "not-json");
  const repository = new LocalAssessmentRepository();
  assert.equal(await repository.getActive(), null);
  memory.values.set(ASSESSMENT_HISTORY_KEY, "{}");
  assert.deepEqual(await repository.getHistory(), []);
  memory.values.set(
    ACTIVE_ASSESSMENT_KEY,
    JSON.stringify({
      id: "partial",
      packVersion: "2026.1",
      mode: "practice",
      status: "active",
      questionIds: ["q1"],
      answers: null,
      flaggedQuestionIds: [],
      currentIndex: 8,
      startedAt: 1,
      deadlineAt: null,
      completedAt: null,
    }),
  );
  assert.equal(await repository.getActive(), null);
});

test("drops an active attempt that no longer matches its mode plan", async () => {
  const memory = new MemoryStorage();
  useStorage(memory);
  const invalid = createAssessmentAttempt({
    id: "untimed-mock",
    packVersion: "2026.1",
    mode: "mock-standard",
    questionIds: Array.from({ length: 50 }, (_, index) => `q${index + 1}`),
    startedAt: 1,
    durationMs: null,
  });
  memory.values.set(ACTIVE_ASSESSMENT_KEY, JSON.stringify(invalid));
  assert.equal(await new LocalAssessmentRepository().getActive(), null);
  assert.equal(memory.getItem(ACTIVE_ASSESSMENT_KEY), null);
});

test("drops nested corruption instead of letting history consumers crash", async () => {
  const memory = new MemoryStorage();
  useStorage(memory);
  const safe = completed("safe", 2);
  memory.values.set(
    ASSESSMENT_HISTORY_KEY,
    JSON.stringify([
      { ...safe, id: "bad-category", score: { ...safe.score, categories: [null] } },
      { ...safe, id: "bad-result", score: { ...safe.score, results: [{ questionId: "q1" }] } },
      { ...safe, id: "bad-count", score: { ...safe.score, correct: -1 } },
      safe,
    ]),
  );
  assert.deepEqual(
    (await new LocalAssessmentRepository().getHistory()).map(({ id }) => id),
    ["safe"],
  );
});

test("drops completed history that contradicts its mode lifecycle", async () => {
  const memory = new MemoryStorage();
  useStorage(memory);
  const safe = completed("safe", 2);
  const oneQuestion = {
    ...safe,
    id: "one-question-practice",
    questionIds: ["q1"],
    score: {
      correct: 1,
      total: 1,
      unanswered: 0,
      accuracy: 100,
      results: [safe.score.results[0]],
      categories: [{ id: "rights", label: "権利関係", correct: 1, total: 1 }],
    },
  };
  memory.values.set(
    ASSESSMENT_HISTORY_KEY,
    JSON.stringify([oneQuestion, { ...safe, id: "before-start", completedAt: 0 }, safe]),
  );
  assert.deepEqual(
    (await new LocalAssessmentRepository().getHistory()).map(({ id }) => id),
    ["safe"],
  );
});
