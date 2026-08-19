import type { AssessmentAttempt, CompletedAssessment } from "../assessment/assessment-attempt.ts";

export interface AssessmentRepository {
  getActive(): Promise<AssessmentAttempt | null>;
  saveActive(attempt: AssessmentAttempt): Promise<void>;
  clearActive(): Promise<void>;
  getHistory(): Promise<CompletedAssessment[]>;
  saveCompleted(assessment: CompletedAssessment): Promise<void>;
}
