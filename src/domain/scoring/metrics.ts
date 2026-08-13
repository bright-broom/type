export type MetricsInput = {
  correct: number;
  incorrect: number;
  elapsedMs: number;
};

export type SessionMetrics = {
  correctKeystrokes: number;
  totalKeystrokes: number;
  accuracy: number;
  wpm: number;
  cpm: number;
  elapsedMs: number;
};

function finiteRound(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function calculateMetrics(input: MetricsInput): SessionMetrics {
  const correct = Math.max(0, input.correct);
  const incorrect = Math.max(0, input.incorrect);
  const elapsedMs = Math.max(0, input.elapsedMs);
  const total = correct + incorrect;
  const elapsedMinutes = elapsedMs / 60_000;
  return {
    correctKeystrokes: correct,
    totalKeystrokes: total,
    accuracy: total === 0 ? 100 : finiteRound((correct / total) * 100),
    wpm: elapsedMinutes === 0 ? 0 : finiteRound(correct / 5 / elapsedMinutes, 1),
    cpm: elapsedMinutes === 0 ? 0 : finiteRound(correct / elapsedMinutes, 1),
    elapsedMs,
  };
}
