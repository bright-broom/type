import { ASSESSMENT_PLANS } from "../../domain/assessment/assessment-plans.ts";
import type { AssessmentQuestion } from "../../domain/assessment/assessment-types.ts";
import type { AssessmentAttempt } from "./assessment-attempt.ts";

export function assessmentAttemptMatchesPlan(attempt: AssessmentAttempt): boolean {
  const plan = ASSESSMENT_PLANS[attempt.mode];
  if (attempt.questionIds.length !== plan.questionCount) return false;
  if (plan.durationMs === null) {
    if (attempt.deadlineAt !== null) return false;
  } else if (attempt.deadlineAt !== attempt.startedAt + plan.durationMs) {
    return false;
  }
  const answersAreInWindow = Object.values(attempt.answers).every(
    ({ answeredAt }) =>
      answeredAt >= attempt.startedAt && (attempt.deadlineAt === null || answeredAt < attempt.deadlineAt),
  );
  if (!answersAreInWindow) return false;
  if (attempt.status === "active") return attempt.completedAt === null;
  if (attempt.status === "expired") {
    return attempt.deadlineAt !== null && attempt.completedAt === attempt.deadlineAt;
  }
  return (
    attempt.completedAt !== null &&
    attempt.completedAt >= attempt.startedAt &&
    (attempt.deadlineAt === null || attempt.completedAt < attempt.deadlineAt)
  );
}

export function assessmentAttemptMatchesQuestions(
  attempt: AssessmentAttempt,
  questions: ReadonlyArray<AssessmentQuestion>,
): boolean {
  const byId = new Map(questions.map((question) => [question.id, question]));
  if (attempt.questionIds.some((questionId) => !byId.has(questionId))) return false;
  return Object.values(attempt.answers).every((answer) =>
    byId.get(answer.questionId)?.choices.some((choice) => choice.id === answer.choiceId),
  );
}
