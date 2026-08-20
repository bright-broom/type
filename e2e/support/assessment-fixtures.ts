import type { Page } from "@playwright/test";
import { createAssessmentAttempt } from "../../src/application/assessment/assessment-attempt.ts";
import { TAKKEN_ASSESSMENT_QUESTIONS, TAKKEN_PACK_VERSION } from "../../src/content/takken/takken-assessment-pack.ts";
import { ACTIVE_ASSESSMENT_KEY } from "../../src/infrastructure/persistence/local-assessment-repository.ts";

const PRACTICE_QUESTION_COUNT = 10;
const FIXTURE_STARTED_AT = Date.UTC(2026, 7, 20, 0, 0, 0);

function fixtureChoiceId(question: (typeof TAKKEN_ASSESSMENT_QUESTIONS)[number], index: number): string {
  if (index % 3 === 0) return question.correctChoiceId;
  const incorrect = question.choices.find(({ id }) => id !== question.correctChoiceId);
  if (!incorrect) throw new Error(`Question ${question.id} has no incorrect fixture choice`);
  return incorrect.id;
}

function answeredPracticeAttempt() {
  const questions = TAKKEN_ASSESSMENT_QUESTIONS.slice(0, PRACTICE_QUESTION_COUNT);
  const attempt = createAssessmentAttempt({
    id: "e2e-answered-practice",
    packVersion: TAKKEN_PACK_VERSION,
    mode: "practice",
    questionIds: questions.map(({ id }) => id),
    startedAt: FIXTURE_STARTED_AT,
    durationMs: null,
  });
  return {
    ...attempt,
    currentIndex: questions.length - 1,
    answers: Object.fromEntries(
      questions.map((question, index) => [
        question.id,
        {
          questionId: question.id,
          choiceId: fixtureChoiceId(question, index),
          answeredAt: FIXTURE_STARTED_AT + index + 1,
        },
      ]),
    ),
  };
}

export async function openAnsweredPractice(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(({ key, attempt }) => localStorage.setItem(key, JSON.stringify(attempt)), {
    key: ACTIVE_ASSESSMENT_KEY,
    attempt: answeredPracticeAttempt(),
  });
  await page.goto("/takken/practice");
  await page.getByText(`${PRACTICE_QUESTION_COUNT} / ${PRACTICE_QUESTION_COUNT}`).waitFor();
}

export async function submitAnsweredPractice(page: Page): Promise<void> {
  await openAnsweredPractice(page);
  await page.getByRole("button", { name: "採点する" }).click();
  await page.getByRole("button", { name: "提出して採点" }).click();
  await page.locator(".assessment-result-shell").waitFor();
  await page.getByRole("heading", { name: "復習する問題" }).waitFor();
}
