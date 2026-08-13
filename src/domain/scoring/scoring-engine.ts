import type { SessionMetrics } from "./metrics.ts";

export type ScoreInput = SessionMetrics & {
  completedPrompts: number;
  maxCombo: number;
};

export function calculateScore(input: ScoreInput): number {
  const accuracyFactor = Math.max(0, Math.min(1, input.accuracy / 100));
  const base = input.correctKeystrokes * 10;
  const completionBonus = input.completedPrompts * 75;
  const comboBonus = input.maxCombo * 3;
  return Math.round((base + completionBonus + comboBonus) * (0.55 + accuracyFactor * 0.45));
}
