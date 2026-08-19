export type AssessmentMode = "practice" | "mock-standard" | "mock-exempt";

export type AssessmentChoice = {
  id: string;
  text: string;
};

export type AssessmentQuestion = {
  id: string;
  revision: number;
  stem: string;
  choices: readonly [AssessmentChoice, AssessmentChoice, AssessmentChoice, AssessmentChoice];
  correctChoiceId: string;
  explanation: string;
  categoryId: string;
  categoryLabel: string;
  conceptIds: ReadonlyArray<string>;
  legalBasisDate: string;
  sourceKind: "original-derived" | "licensed-official";
  sourceLabel: string;
  reviewStatus: "provisional" | "published";
};

export type AssessmentPlan = {
  mode: AssessmentMode;
  questionCount: number;
  durationMs: number | null;
  feedback: "immediate" | "after-submission";
};

export type AssessmentAnswer = {
  questionId: string;
  choiceId: string;
  answeredAt: number;
};

export type AssessmentQuestionResult = {
  questionId: string;
  choiceId: string | null;
  correctChoiceId: string;
  correct: boolean;
  categoryId: string;
};

export type AssessmentScore = {
  correct: number;
  total: number;
  unanswered: number;
  accuracy: number;
  results: ReadonlyArray<AssessmentQuestionResult>;
  categories: ReadonlyArray<{
    id: string;
    label: string;
    correct: number;
    total: number;
  }>;
};
