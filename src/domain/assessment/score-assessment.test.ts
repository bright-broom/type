import assert from "node:assert/strict";
import test from "node:test";
import type { AssessmentQuestion } from "./assessment-types.ts";
import { scoreAssessment } from "./score-assessment.ts";

function question(id: string, categoryId = "rights"): AssessmentQuestion {
  return {
    id,
    revision: 1,
    stem: id,
    choices: [
      { id: "1", text: "one" },
      { id: "2", text: "two" },
      { id: "3", text: "three" },
      { id: "4", text: "four" },
    ],
    correctChoiceId: "2",
    explanation: "because",
    categoryId,
    categoryLabel: categoryId,
    conceptIds: [`concept:${id}`],
    legalBasisDate: "2026-04-01",
    sourceKind: "original-derived",
    sourceLabel: "original",
    reviewStatus: "published",
  };
}

test("scores answers, omissions, and categories without mutating the attempt", () => {
  const answers = {
    q1: { questionId: "q1", choiceId: "2", answeredAt: 1 },
    q2: { questionId: "q2", choiceId: "1", answeredAt: 2 },
  };
  const score = scoreAssessment([question("q1"), question("q2"), question("q3", "law")], answers);

  assert.equal(score.correct, 1);
  assert.equal(score.unanswered, 1);
  assert.equal(score.accuracy, 33.3);
  assert.deepEqual(
    score.categories.map(({ id, correct, total }) => ({ id, correct, total })),
    [
      { id: "rights", correct: 1, total: 2 },
      { id: "law", correct: 0, total: 1 },
    ],
  );
  assert.equal(answers.q1.choiceId, "2");
});
