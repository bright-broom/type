import assert from "node:assert/strict";
import test from "node:test";
import type { AssessmentQuestion } from "./assessment-types.ts";
import { selectAssessmentQuestions } from "./select-assessment-questions.ts";

const questions = Array.from({ length: 8 }, (_, index) => ({ id: `q${index}` })) as AssessmentQuestion[];

test("selects a reproducible sample without mutating the question bank", () => {
  const first = selectAssessmentQuestions(questions, 4, 42).map(({ id }) => id);
  const second = selectAssessmentQuestions(questions, 4, 42).map(({ id }) => id);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 4);
  assert.deepEqual(
    questions.map(({ id }) => id),
    ["q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7"],
  );
});
