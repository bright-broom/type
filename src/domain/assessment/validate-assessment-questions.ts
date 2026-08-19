import type { AssessmentQuestion } from "./assessment-types.ts";

export function validateAssessmentQuestions(questions: ReadonlyArray<AssessmentQuestion>): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const question of questions) {
    if (!question.id || ids.has(question.id)) errors.push(`Duplicate or empty question id: ${question.id}`);
    ids.add(question.id);
    if (question.revision < 1) errors.push(`${question.id}: revision must be positive`);
    if (!question.stem.trim()) errors.push(`${question.id}: stem is empty`);
    if (question.choices.length !== 4) errors.push(`${question.id}: exactly four choices are required`);
    const choiceIds = question.choices.map((choice) => choice.id);
    if (new Set(choiceIds).size !== choiceIds.length) errors.push(`${question.id}: choice ids must be unique`);
    if (!choiceIds.includes(question.correctChoiceId)) errors.push(`${question.id}: correct choice does not exist`);
    if (question.choices.some((choice) => !choice.text.trim())) errors.push(`${question.id}: choice text is empty`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(question.legalBasisDate)) {
      errors.push(`${question.id}: legal basis date must be ISO formatted`);
    }
    if (question.conceptIds.length === 0) errors.push(`${question.id}: a concept link is required`);
    if (!(["provisional", "published"] as const).includes(question.reviewStatus)) {
      errors.push(`${question.id}: review status is invalid`);
    }
  }
  return errors;
}
