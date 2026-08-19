import type { AssessmentQuestion, AssessmentScore } from "./assessment-types.ts";
import { selectAssessmentQuestions } from "./select-assessment-questions.ts";

export type CategoryProgress = {
  id: string;
  label: string;
  correct: number;
  total: number;
  accuracy: number;
};

export function summarizeCategoryProgress(scores: ReadonlyArray<AssessmentScore>): CategoryProgress[] {
  const categories = new Map<string, Omit<CategoryProgress, "accuracy">>();
  for (const score of scores) {
    for (const category of score.categories) {
      const current = categories.get(category.id) ?? { id: category.id, label: category.label, correct: 0, total: 0 };
      current.correct += category.correct;
      current.total += category.total;
      categories.set(category.id, current);
    }
  }
  return [...categories.values()]
    .map((category) => ({
      ...category,
      accuracy: category.total === 0 ? 0 : Math.round((category.correct / category.total) * 1_000) / 10,
    }))
    .sort((left, right) => left.accuracy - right.accuracy || right.total - left.total);
}

export function selectPracticeQuestions(
  questions: ReadonlyArray<AssessmentQuestion>,
  scores: ReadonlyArray<AssessmentScore>,
  count: number,
  seed: number,
  focusCategoryId?: string,
): AssessmentQuestion[] {
  const weakness = new Map<string, number>();
  scores.forEach((score, scoreIndex) => {
    const recency = Math.max(1, scores.length - scoreIndex);
    for (const result of score.results) {
      weakness.set(result.questionId, (weakness.get(result.questionId) ?? 0) + (result.correct ? -1 : recency));
    }
  });
  const select = (candidates: ReadonlyArray<AssessmentQuestion>, selectionCount: number, selectionSeed: number) => {
    const weak = candidates
      .filter((question) => (weakness.get(question.id) ?? 0) > 0)
      .sort((left, right) => (weakness.get(right.id) ?? 0) - (weakness.get(left.id) ?? 0));
    const weakLimit = Math.min(weak.length, Math.ceil(selectionCount / 2));
    const selectedWeak = weak.slice(0, weakLimit);
    const selectedIds = new Set(selectedWeak.map(({ id }) => id));
    const remaining = selectAssessmentQuestions(
      candidates.filter(({ id }) => !selectedIds.has(id)),
      selectionCount - selectedWeak.length,
      selectionSeed,
    );
    return [...selectedWeak, ...remaining];
  };
  if (!focusCategoryId) return select(questions, count, seed);
  const focused = select(
    questions.filter(({ categoryId }) => categoryId === focusCategoryId),
    count,
    seed,
  );
  const selectedIds = new Set(focused.map(({ id }) => id));
  const fallback = select(
    questions.filter(({ id }) => !selectedIds.has(id)),
    count - focused.length,
    seed + 1,
  );
  return [...focused, ...fallback];
}
