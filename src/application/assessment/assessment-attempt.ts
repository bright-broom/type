import type { AssessmentAnswer, AssessmentMode, AssessmentScore } from "../../domain/assessment/assessment-types.ts";

export type AssessmentStatus = "active" | "submitted" | "expired" | "abandoned";

export type AssessmentAttempt = {
  id: string;
  packVersion: string;
  mode: AssessmentMode;
  status: AssessmentStatus;
  questionIds: ReadonlyArray<string>;
  answers: Readonly<Record<string, AssessmentAnswer>>;
  flaggedQuestionIds: ReadonlyArray<string>;
  currentIndex: number;
  startedAt: number;
  deadlineAt: number | null;
  completedAt: number | null;
};

export type CompletedAssessment = AssessmentAttempt & {
  status: "submitted" | "expired";
  completedAt: number;
  score: AssessmentScore;
};

export type AssessmentAttemptEvent =
  | { type: "ANSWER"; questionId: string; choiceId: string; now: number }
  | { type: "NAVIGATE"; index: number; now: number }
  | { type: "TOGGLE_FLAG"; questionId: string; now: number }
  | { type: "SUBMIT"; now: number }
  | { type: "TICK"; now: number }
  | { type: "ABANDON"; now: number };

export function createAssessmentAttempt(input: {
  id: string;
  packVersion: string;
  mode: AssessmentMode;
  questionIds: ReadonlyArray<string>;
  startedAt: number;
  durationMs: number | null;
}): AssessmentAttempt {
  return {
    id: input.id,
    packVersion: input.packVersion,
    mode: input.mode,
    status: "active",
    questionIds: [...input.questionIds],
    answers: {},
    flaggedQuestionIds: [],
    currentIndex: 0,
    startedAt: input.startedAt,
    deadlineAt: input.durationMs === null ? null : input.startedAt + input.durationMs,
    completedAt: null,
  };
}

export function remainingAssessmentMs(attempt: AssessmentAttempt, now: number): number | null {
  return attempt.deadlineAt === null ? null : Math.max(0, attempt.deadlineAt - now);
}
