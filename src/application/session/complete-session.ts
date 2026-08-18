import type { KeyPerformance } from "../../domain/analytics/weak-key-analyzer.ts";
import type { SessionMetrics } from "../../domain/scoring/metrics.ts";
import { calculateScore } from "../../domain/scoring/scoring-engine.ts";
import type { CompletedSession, KeystrokeEvent, PromptAttempt, TrainingSet } from "./session-types.ts";

export type SessionOutcome = {
  id: string;
  trainingSet: TrainingSet;
  startedAt: number;
  endedAt: number;
  attempts: ReadonlyArray<PromptAttempt>;
  keystrokes: ReadonlyArray<KeystrokeEvent>;
  metrics: SessionMetrics;
  completedPrompts: number;
  maxCombo: number;
  weakKeys: ReadonlyArray<KeyPerformance>;
};

/**
 * Assemble the persisted record for a finished session.
 *
 * Scoring and the storage shape live here rather than in the React hook so the
 * persisted record can be asserted without rendering a session.
 */
export function completeSession(outcome: SessionOutcome): CompletedSession {
  return {
    id: outcome.id,
    mode: "60s",
    trainingSet: outcome.trainingSet,
    startedAt: outcome.startedAt,
    endedAt: outcome.endedAt,
    prompts: [...outcome.attempts],
    keystrokes: [...outcome.keystrokes],
    metrics: outcome.metrics,
    score: calculateScore({
      ...outcome.metrics,
      completedPrompts: outcome.completedPrompts,
      maxCombo: outcome.maxCombo,
    }),
    completedPrompts: outcome.completedPrompts,
    maxCombo: outcome.maxCombo,
    weakKeys: outcome.weakKeys,
  };
}
