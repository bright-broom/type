import type { AssessmentQuestion } from "./assessment-types.ts";

function seededUnit(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

export function selectAssessmentQuestions(
  questions: ReadonlyArray<AssessmentQuestion>,
  count: number,
  seed: number,
): AssessmentQuestion[] {
  const random = seededUnit(seed);
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, Math.max(0, count));
}
