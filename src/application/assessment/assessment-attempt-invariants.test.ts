import assert from "node:assert/strict";
import test from "node:test";
import type { AssessmentQuestion } from "../../domain/assessment/assessment-types.ts";
import { ASSESSMENT_PLANS } from "../../domain/assessment/assessment-plans.ts";
import { createAssessmentAttempt } from "./assessment-attempt.ts";
import { assessmentAttemptMatchesPlan, assessmentAttemptMatchesQuestions } from "./assessment-attempt-invariants.ts";

const question = {
  id: "q1",
  revision: 1,
  stem: "Question",
  choices: [
    { id: "choice-1", text: "One" },
    { id: "choice-2", text: "Two" },
    { id: "choice-3", text: "Three" },
    { id: "choice-4", text: "Four" },
  ],
  correctChoiceId: "choice-1",
  explanation: "Explanation",
  categoryId: "category-1",
  categoryLabel: "Category",
  conceptIds: ["concept-1"],
  legalBasisDate: "2026-04-01",
  sourceKind: "original-derived",
  sourceLabel: "Test fixture",
  reviewStatus: "provisional",
} satisfies AssessmentQuestion;

test("an attempt must preserve its mode's question count and deadline", () => {
  const plan = ASSESSMENT_PLANS["mock-standard"];
  const attempt = createAssessmentAttempt({
    id: "attempt-1",
    packVersion: "pack-1",
    mode: "mock-standard",
    questionIds: Array.from({ length: plan.questionCount }, (_, index) => `q${index + 1}`),
    startedAt: 1_000,
    durationMs: plan.durationMs,
  });
  assert.equal(assessmentAttemptMatchesPlan(attempt), true);
  assert.equal(assessmentAttemptMatchesPlan({ ...attempt, deadlineAt: null }), false);
  assert.equal(assessmentAttemptMatchesPlan({ ...attempt, questionIds: ["q1"] }), false);
});

test("completion status must agree with the attempt's time window", () => {
  const attempt = createAssessmentAttempt({
    id: "attempt-1",
    packVersion: "pack-1",
    mode: "practice",
    questionIds: Array.from({ length: 10 }, (_, index) => `q${index + 1}`),
    startedAt: 1_000,
    durationMs: null,
  });
  assert.equal(assessmentAttemptMatchesPlan({ ...attempt, status: "submitted", completedAt: 1_100 }), true);
  assert.equal(assessmentAttemptMatchesPlan({ ...attempt, status: "submitted", completedAt: 999 }), false);
  assert.equal(assessmentAttemptMatchesPlan({ ...attempt, status: "expired", completedAt: 1_100 }), false);
});

test("restored answers must resolve to a real choice for their question", () => {
  const attempt = createAssessmentAttempt({
    id: "attempt-1",
    packVersion: "pack-1",
    mode: "practice",
    questionIds: ["q1"],
    startedAt: 1_000,
    durationMs: null,
  });
  const answered = {
    ...attempt,
    answers: { q1: { questionId: "q1", choiceId: "choice-1", answeredAt: 1_100 } },
  };
  assert.equal(assessmentAttemptMatchesQuestions(answered, [question]), true);
  assert.equal(
    assessmentAttemptMatchesQuestions(
      { ...answered, answers: { q1: { ...answered.answers.q1, choiceId: "not-a-choice" } } },
      [question],
    ),
    false,
  );
});
