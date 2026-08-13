import type { KeyPerformance } from "../../domain/analytics/weak-key-analyzer.ts";
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

export type AppSettings = {
  soundEnabled: boolean;
};
