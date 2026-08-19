import assert from "node:assert/strict";
import test from "node:test";
import { validateAssessmentQuestions } from "../../domain/assessment/validate-assessment-questions.ts";
import {
  TAKKEN_ASSESSMENT_QUESTIONS,
  TAKKEN_LEGAL_BASIS_DATE,
  TAKKEN_PACK_REVIEW_STATUS,
  TAKKEN_PACK_VERSION,
} from "./takken-assessment-pack.ts";
import { selectPracticeQuestions } from "../../domain/assessment/assessment-progress.ts";

test("builds a valid, content-versioned 2026 original fifty-question pack", () => {
  assert.match(TAKKEN_PACK_VERSION, /^2026\.1-[0-9a-f]{8}$/);
  assert.equal(TAKKEN_ASSESSMENT_QUESTIONS.length, 50);
  assert.deepEqual(validateAssessmentQuestions(TAKKEN_ASSESSMENT_QUESTIONS), []);
  assert.ok(TAKKEN_ASSESSMENT_QUESTIONS.every((question) => question.legalBasisDate === TAKKEN_LEGAL_BASIS_DATE));
  assert.ok(TAKKEN_ASSESSMENT_QUESTIONS.every((question) => question.reviewStatus === TAKKEN_PACK_REVIEW_STATUS));
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(TAKKEN_ASSESSMENT_QUESTIONS.map(({ categoryId }) => categoryId))].map((categoryId) => [
        categoryId,
        TAKKEN_ASSESSMENT_QUESTIONS.filter((question) => question.categoryId === categoryId).length,
      ]),
    ),
    { rights: 14, "legal-restrictions": 8, "brokerage-law": 20, "tax-and-others": 8 },
  );
});

test("every selectable focus starts an exact ten-question practice set", () => {
  for (const categoryId of ["rights", "legal-restrictions", "brokerage-law", "tax-and-others"]) {
    const selected = selectPracticeQuestions(TAKKEN_ASSESSMENT_QUESTIONS, [], 10, 1, categoryId);
    assert.equal(selected.length, 10, categoryId);
    assert.ok(
      selected.some((question) => question.categoryId === categoryId),
      categoryId,
    );
  }
});

test("question identity follows its concept and every choice set is structurally distinct", () => {
  for (const question of TAKKEN_ASSESSMENT_QUESTIONS) {
    assert.equal(new Set(question.choices.map(({ text }) => text)).size, 4, `${question.id} repeats choice text`);
    assert.match(question.conceptIds[0], /^takken-term-\d{3}$/);
    assert.ok(question.id.includes(question.conceptIds[0].replace("takken-", "")));
  }
});
