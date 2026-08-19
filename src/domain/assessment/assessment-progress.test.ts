import assert from "node:assert/strict";
import test from "node:test";
import type { AssessmentQuestion, AssessmentScore } from "./assessment-types.ts";
import { selectPracticeQuestions, summarizeCategoryProgress } from "./assessment-progress.ts";

const questions = Array.from({ length: 6 }, (_, index) => ({ id: `q${index}` })) as AssessmentQuestion[];

function score(questionId: string, correct: boolean): AssessmentScore {
  return {
    correct: correct ? 1 : 0,
    total: 1,
    unanswered: 0,
    accuracy: correct ? 100 : 0,
    results: [{ questionId, choiceId: "1", correctChoiceId: correct ? "1" : "2", correct, categoryId: "rights" }],
    categories: [{ id: "rights", label: "権利関係", correct: correct ? 1 : 0, total: 1 }],
  };
}

test("practice reserves half its questions for weak items and fills without duplicates", () => {
  const selected = selectPracticeQuestions(questions, [score("q3", false), score("q4", false)], 4, 10);
  assert.deepEqual(
    selected.slice(0, 2).map(({ id }) => id),
    ["q3", "q4"],
  );
  assert.equal(new Set(selected.map(({ id }) => id)).size, 4);
});

test("a focus category is prioritized but never shortens a requested practice set", () => {
  const categorized = questions.map((question, index) => ({
    ...question,
    categoryId: index < 3 ? "focus" : "fallback",
  }));
  const selected = selectPracticeQuestions(categorized, [], 5, 10, "focus");
  assert.equal(selected.length, 5);
  assert.equal(selected.filter(({ categoryId }) => categoryId === "focus").length, 3);
  assert.equal(new Set(selected.map(({ id }) => id)).size, 5);
});

test("category progress aggregates attempts and puts the weakest area first", () => {
  const law: AssessmentScore = {
    ...score("q2", true),
    categories: [{ id: "law", label: "宅建業法", correct: 1, total: 1 }],
  };
  assert.deepEqual(summarizeCategoryProgress([score("q1", false), law]), [
    { id: "rights", label: "権利関係", correct: 0, total: 1, accuracy: 0 },
    { id: "law", label: "宅建業法", correct: 1, total: 1, accuracy: 100 },
  ]);
});
