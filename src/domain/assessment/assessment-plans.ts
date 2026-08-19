import type { AssessmentMode, AssessmentPlan } from "./assessment-types.ts";

export const STANDARD_MOCK_DURATION_MS = 120 * 60 * 1_000;
export const EXEMPT_MOCK_DURATION_MS = 110 * 60 * 1_000;

export const ASSESSMENT_PLANS: Record<AssessmentMode, AssessmentPlan> = {
  practice: {
    mode: "practice",
    questionCount: 10,
    durationMs: null,
    feedback: "immediate",
  },
  "mock-standard": {
    mode: "mock-standard",
    questionCount: 50,
    durationMs: STANDARD_MOCK_DURATION_MS,
    feedback: "after-submission",
  },
  "mock-exempt": {
    mode: "mock-exempt",
    questionCount: 45,
    durationMs: EXEMPT_MOCK_DURATION_MS,
    feedback: "after-submission",
  },
};
