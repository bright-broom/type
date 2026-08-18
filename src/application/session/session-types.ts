import type { KeyPerformance } from "../../domain/analytics/weak-key-analyzer.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import type { SessionMetrics } from "../../domain/scoring/metrics.ts";

export type KeystrokeEvent = {
  timestamp: number;
  key: string;
  normalizedKey: string;
  correct: boolean;
  promptId: string;
  position: number;
};

export type PromptAttempt = {
  promptId: string;
  startedAt: number;
  completedAt?: number;
  input: string;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
};

export type CompletedSession = {
  id: string;
  mode: "60s";
  trainingSet?: TrainingSet;
  startedAt: number;
  endedAt: number;
  prompts: ReadonlyArray<PromptAttempt>;
  keystrokes: ReadonlyArray<KeystrokeEvent>;
  metrics: SessionMetrics;
  score: number;
  completedPrompts: number;
  maxCombo: number;
  weakKeys: ReadonlyArray<KeyPerformance>;
};

/**
 * Live feedback for the current keystroke. `unsupported` means the input could not
 * be consumed at all (for example kana from a software keyboard left in Japanese
 * mode), which is a keyboard-mode problem rather than a typing mistake.
 */
export type TypingFeedback = "correct" | "miss" | "complete" | "unsupported" | null;

export type AppSettings = {
  soundEnabled: boolean;
};
