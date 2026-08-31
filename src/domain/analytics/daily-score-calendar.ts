export type DatedScore = {
  endedAt: number;
  score: number;
};

export type DailyScore = {
  dateKey: string;
  day: number;
  bestScore: number;
  sessionCount: number;
};

export function isDailyScore(value: unknown): value is DailyScore {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.dateKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.dateKey) &&
    typeof record.day === "number" &&
    Number.isInteger(record.day) &&
    record.day >= 1 &&
    record.day <= 31 &&
    typeof record.bestScore === "number" &&
    Number.isFinite(record.bestScore) &&
    typeof record.sessionCount === "number" &&
    Number.isInteger(record.sessionCount) &&
    record.sessionCount > 0
  );
}

const DATE_KEY_PART_LENGTH = 2;

export function localDateKey(timestamp: number): string | null {
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(DATE_KEY_PART_LENGTH, "0");
  const day = String(date.getDate()).padStart(DATE_KEY_PART_LENGTH, "0");
  return `${year}-${month}-${day}`;
}

export function collectDailyScores(
  records: ReadonlyArray<DatedScore>,
  year: number,
  month: number,
): ReadonlyMap<string, DailyScore> {
  const dailyScores = new Map<string, DailyScore>();

  for (const record of records) {
    if (!Number.isFinite(record.score)) continue;
    const date = new Date(record.endedAt);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month) continue;
    const dateKey = localDateKey(record.endedAt);
    if (!dateKey) continue;
    const current = dailyScores.get(dateKey);
    dailyScores.set(dateKey, {
      dateKey,
      day: date.getDate(),
      bestScore: Math.max(current?.bestScore ?? record.score, record.score),
      sessionCount: (current?.sessionCount ?? 0) + 1,
    });
  }

  return dailyScores;
}

export function summarizeDailyScores(records: ReadonlyArray<DatedScore>): DailyScore[] {
  const scores = new Map<string, DailyScore>();
  for (const record of records) {
    const dateKey = localDateKey(record.endedAt);
    if (!dateKey || !Number.isFinite(record.score)) continue;
    const date = new Date(record.endedAt);
    const current = scores.get(dateKey);
    scores.set(dateKey, {
      dateKey,
      day: date.getDate(),
      bestScore: Math.max(current?.bestScore ?? record.score, record.score),
      sessionCount: (current?.sessionCount ?? 0) + 1,
    });
  }
  return [...scores.values()].sort((left, right) => right.dateKey.localeCompare(left.dateKey));
}

export function addDailyScore(existing: ReadonlyArray<DailyScore>, record: DatedScore): DailyScore[] {
  const dateKey = localDateKey(record.endedAt);
  if (!dateKey || !Number.isFinite(record.score)) return [...existing];
  const current = existing.find((score) => score.dateKey === dateKey);
  const next: DailyScore = {
    ...current,
    dateKey,
    day: new Date(record.endedAt).getDate(),
    bestScore: Math.max(current?.bestScore ?? record.score, record.score),
    sessionCount: (current?.sessionCount ?? 0) + 1,
  };
  return [next, ...existing.filter((score) => score.dateKey !== dateKey)].sort((left, right) =>
    right.dateKey.localeCompare(left.dateKey),
  );
}
