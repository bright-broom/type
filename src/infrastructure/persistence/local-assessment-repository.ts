import type { AssessmentRepository } from "../../application/ports/assessment-repository.ts";
import type { AssessmentAttempt, CompletedAssessment } from "../../application/assessment/assessment-attempt.ts";
import { assessmentAttemptMatchesPlan } from "../../application/assessment/assessment-attempt-invariants.ts";

export const ACTIVE_ASSESSMENT_KEY = "typeloop:assessment-active:v1";
export const ASSESSMENT_HISTORY_KEY = "typeloop:assessment-history:v1";
const MAX_ASSESSMENTS = 50;

type StoredQuestionResult = {
  questionId: string;
  choiceId: string | null;
  correctChoiceId: string;
  correct: boolean;
  categoryId: string;
};

type StoredCategoryScore = { id: string; label: string; correct: number; total: number };

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Assessment recovery is best-effort and may not make the app unusable.
  }
}

function remove(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // A blocked store behaves like an empty store.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isAnswer(value: unknown, questionId: string, questionIds: ReadonlyArray<string>): boolean {
  return (
    isRecord(value) &&
    value.questionId === questionId &&
    questionIds.includes(questionId) &&
    typeof value.choiceId === "string" &&
    value.choiceId.length > 0 &&
    isFiniteNumber(value.answeredAt)
  );
}

function isAttempt(value: unknown): value is AssessmentAttempt {
  if (!isRecord(value)) return false;
  const questionIds = value.questionIds;
  const flaggedQuestionIds = value.flaggedQuestionIds;
  const answers = value.answers;
  const active = value.status === "active";
  return (
    typeof value.id === "string" &&
    typeof value.packVersion === "string" &&
    ["practice", "mock-standard", "mock-exempt"].includes(String(value.mode)) &&
    ["active", "submitted", "expired", "abandoned"].includes(String(value.status)) &&
    Array.isArray(questionIds) &&
    questionIds.length > 0 &&
    questionIds.every((id) => typeof id === "string") &&
    new Set(questionIds).size === questionIds.length &&
    isRecord(answers) &&
    Object.entries(answers).every(([questionId, answer]) => isAnswer(answer, questionId, questionIds)) &&
    Array.isArray(flaggedQuestionIds) &&
    flaggedQuestionIds.every((id) => typeof id === "string" && questionIds.includes(id)) &&
    isFiniteNumber(value.currentIndex) &&
    Number.isInteger(value.currentIndex) &&
    value.currentIndex >= 0 &&
    value.currentIndex < questionIds.length &&
    isFiniteNumber(value.startedAt) &&
    (value.deadlineAt === null || (isFiniteNumber(value.deadlineAt) && value.deadlineAt >= value.startedAt)) &&
    (active ? value.completedAt === null : isFiniteNumber(value.completedAt))
  );
}

function isQuestionResult(value: unknown, questionIds: ReadonlyArray<string>): value is StoredQuestionResult {
  return (
    isRecord(value) &&
    typeof value.questionId === "string" &&
    questionIds.includes(value.questionId) &&
    (value.choiceId === null || (typeof value.choiceId === "string" && value.choiceId.length > 0)) &&
    typeof value.correctChoiceId === "string" &&
    value.correctChoiceId.length > 0 &&
    typeof value.correct === "boolean" &&
    value.correct === (value.choiceId === value.correctChoiceId) &&
    typeof value.categoryId === "string" &&
    value.categoryId.length > 0
  );
}

function isCategoryScore(value: unknown): value is StoredCategoryScore {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.label === "string" &&
    value.label.length > 0 &&
    isCount(value.correct) &&
    isCount(value.total) &&
    value.correct <= value.total
  );
}

function isCompleted(value: unknown): value is CompletedAssessment {
  if (!isAttempt(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  const score = record.score;
  if (
    !["submitted", "expired"].includes(String(record.status)) ||
    !assessmentAttemptMatchesPlan(value) ||
    !isFiniteNumber(record.completedAt) ||
    !isRecord(score) ||
    !isCount(score.correct) ||
    !isCount(score.total) ||
    !isCount(score.unanswered) ||
    !isFiniteNumber(score.accuracy) ||
    !Array.isArray(score.results) ||
    !Array.isArray(score.categories)
  ) {
    return false;
  }
  const questionIds = value.questionIds;
  if (
    score.total !== questionIds.length ||
    score.results.length !== score.total ||
    !score.results.every((result) => isQuestionResult(result, questionIds)) ||
    new Set(score.results.map((result) => result.questionId)).size !== score.results.length ||
    !score.categories.every(isCategoryScore)
  ) {
    return false;
  }
  const results = score.results;
  const categories = score.categories;
  const correct = results.filter((result) => result.correct).length;
  const unanswered = results.filter((result) => result.choiceId === null).length;
  const categoryCorrect = categories.reduce((total, category) => total + category.correct, 0);
  const categoryTotal = categories.reduce((total, category) => total + category.total, 0);
  const expectedAccuracy = Math.round((correct / score.total) * 1_000) / 10;
  const answersMatch = results.every(
    (result) => result.choiceId === (value.answers[result.questionId]?.choiceId ?? null),
  );
  const categoriesMatch = categories.every((category) => {
    const categoryResults = results.filter((result) => result.categoryId === category.id);
    return (
      categoryResults.length === category.total &&
      categoryResults.filter((result) => result.correct).length === category.correct
    );
  });
  return (
    score.correct === correct &&
    score.unanswered === unanswered &&
    score.accuracy === expectedAccuracy &&
    categoryCorrect === correct &&
    categoryTotal === score.total &&
    new Set(categories.map((category) => category.id)).size === categories.length &&
    answersMatch &&
    categoriesMatch
  );
}

export class LocalAssessmentRepository implements AssessmentRepository {
  async getActive(): Promise<AssessmentAttempt | null> {
    const value = readJson(ACTIVE_ASSESSMENT_KEY);
    if (isAttempt(value) && value.status === "active" && assessmentAttemptMatchesPlan(value)) return value;
    if (value !== null) remove(ACTIVE_ASSESSMENT_KEY);
    return null;
  }

  async saveActive(attempt: AssessmentAttempt): Promise<void> {
    writeJson(ACTIVE_ASSESSMENT_KEY, attempt);
  }

  async clearActive(): Promise<void> {
    remove(ACTIVE_ASSESSMENT_KEY);
  }

  async getHistory(): Promise<CompletedAssessment[]> {
    const value = readJson(ASSESSMENT_HISTORY_KEY);
    return Array.isArray(value) ? value.filter(isCompleted) : [];
  }

  async saveCompleted(assessment: CompletedAssessment): Promise<void> {
    const current = await this.getHistory();
    const withoutDuplicate = current.filter(({ id }) => id !== assessment.id);
    writeJson(ASSESSMENT_HISTORY_KEY, [assessment, ...withoutDuplicate].slice(0, MAX_ASSESSMENTS));
  }
}
