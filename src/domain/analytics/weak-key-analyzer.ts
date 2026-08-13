export type KeyStrokeSample = { key: string; correct: boolean };

export type KeyPerformance = {
  key: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
};

export const MIN_WEAK_KEY_SAMPLE = 5;

export function analyzeWeakKeys(
  samples: ReadonlyArray<KeyStrokeSample>,
  minimumSample = MIN_WEAK_KEY_SAMPLE,
): KeyPerformance[] {
  const aggregate = new Map<string, { total: number; correct: number }>();
  for (const sample of samples) {
    const key = sample.key.toLowerCase();
    const entry = aggregate.get(key) ?? { total: 0, correct: 0 };
    entry.total += 1;
    if (sample.correct) entry.correct += 1;
    aggregate.set(key, entry);
  }
  return [...aggregate.entries()]
    .filter(([, value]) => value.total >= minimumSample)
    .map(([key, value]) => ({
      key,
      total: value.total,
      correct: value.correct,
      incorrect: value.total - value.correct,
      accuracy: Math.round((value.correct / value.total) * 1000) / 10,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.key.localeCompare(b.key));
}
