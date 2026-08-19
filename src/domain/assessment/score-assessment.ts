import type { AssessmentAnswer, AssessmentQuestion, AssessmentScore } from "./assessment-types.ts";

export function scoreAssessment(
  questions: ReadonlyArray<AssessmentQuestion>,
  answers: Readonly<Record<string, AssessmentAnswer>>,
): AssessmentScore {
  const categoryScores = new Map<string, { id: string; label: string; correct: number; total: number }>();
  const results = questions.map((question) => {
    const answer = answers[question.id];
    const correct = answer?.choiceId === question.correctChoiceId;
    const category = categoryScores.get(question.categoryId) ?? {
      id: question.categoryId,
      label: question.categoryLabel,
      correct: 0,
      total: 0,
    };
    category.total += 1;
    if (correct) category.correct += 1;
    categoryScores.set(question.categoryId, category);
    return {
      questionId: question.id,
      choiceId: answer?.choiceId ?? null,
      correctChoiceId: question.correctChoiceId,
      correct,
      categoryId: question.categoryId,
    };
  });
  const correct = results.filter((result) => result.correct).length;
  const unanswered = results.filter((result) => result.choiceId === null).length;
  return {
    correct,
    total: questions.length,
    unanswered,
    accuracy: questions.length === 0 ? 0 : Math.round((correct / questions.length) * 1_000) / 10,
    results,
    categories: [...categoryScores.values()],
  };
}
