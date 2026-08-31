import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from "../../application/settings/app-settings.ts";
import type { CompletedSession } from "../../application/session/session-types.ts";
import { isDailyScore, summarizeDailyScores, type DailyScore } from "../../domain/analytics/daily-score-calendar.ts";

/**
 * Layout of the single localStorage entry that holds a player's whole history.
 *
 * The version describes the *envelope*, not the sessions inside it. Session records
 * are read field by field, so adding a field to `CompletedSession` never needs a
 * version bump and never invalidates stored history.
 */
export type StorageEnvelope = {
  version: number;
  sessions: CompletedSession[];
  dailyScores: DailyScore[];
  settings: AppSettings;
  [key: string]: unknown;
};

export const STORAGE_VERSION = 1;

const EMPTY_METRICS = {
  wpm: 0,
  cpm: 0,
  accuracy: 0,
  correctKeystrokes: 0,
  totalKeystrokes: 0,
  elapsedMs: 0,
};

function migrateSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return normalizeAppSettings(value);
  const unknownSettings = { ...(value as Record<string, unknown>) };
  delete unknownSettings.appearance;
  return { ...unknownSettings, ...normalizeAppSettings(value) } as AppSettings;
}

export function emptyEnvelope(): StorageEnvelope {
  return {
    version: STORAGE_VERSION,
    sessions: [],
    dailyScores: [],
    settings: { ...DEFAULT_APP_SETTINGS },
  };
}

/**
 * A record is usable when the fields history and personal bests are keyed on are
 * present. Everything else is optional on purpose: a session written by an older
 * build stays playable in the history list instead of being thrown away.
 */
export function isSession(value: unknown): value is CompletedSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.score === "number" &&
    Number.isFinite(record.score) &&
    typeof record.endedAt === "number" &&
    Number.isFinite(record.endedAt)
  );
}

function finiteMetric(metrics: Record<string, unknown>, key: string): number | null {
  const value = metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeSession(value: unknown): CompletedSession | null {
  if (!isSession(value)) return null;
  const record = value as unknown as Record<string, unknown>;
  const storedMetrics =
    record.metrics && typeof record.metrics === "object" ? (record.metrics as Record<string, unknown>) : {};
  const wpm = finiteMetric(storedMetrics, "wpm");
  const accuracy = finiteMetric(storedMetrics, "accuracy");
  const metricsAvailable = wpm !== null && accuracy !== null;

  return {
    ...record,
    id: value.id,
    mode: typeof record.mode === "string" ? record.mode : "60s",
    startedAt:
      typeof record.startedAt === "number" && Number.isFinite(record.startedAt) ? record.startedAt : value.endedAt,
    endedAt: value.endedAt,
    prompts: Array.isArray(record.prompts) ? (record.prompts as CompletedSession["prompts"]) : [],
    keystrokes: Array.isArray(record.keystrokes) ? (record.keystrokes as CompletedSession["keystrokes"]) : [],
    metrics: metricsAvailable
      ? {
          ...storedMetrics,
          wpm,
          accuracy,
          cpm: finiteMetric(storedMetrics, "cpm") ?? 0,
          correctKeystrokes: finiteMetric(storedMetrics, "correctKeystrokes") ?? 0,
          totalKeystrokes: finiteMetric(storedMetrics, "totalKeystrokes") ?? 0,
          elapsedMs: finiteMetric(storedMetrics, "elapsedMs") ?? 0,
        }
      : EMPTY_METRICS,
    metricsAvailable,
    score: value.score,
    completedPrompts:
      typeof record.completedPrompts === "number" && Number.isFinite(record.completedPrompts)
        ? record.completedPrompts
        : 0,
    maxCombo: typeof record.maxCombo === "number" && Number.isFinite(record.maxCombo) ? record.maxCombo : 0,
    weakKeys: Array.isArray(record.weakKeys) ? (record.weakKeys as CompletedSession["weakKeys"]) : [],
  } as CompletedSession;
}

/**
 * Read any persisted payload into the current envelope, keeping every session that
 * still validates.
 *
 * The previous implementation discarded the entire entry when the version did not
 * equal the current one, so the first envelope change would have silently deleted
 * every player's history and personal bests. A local-first app holds that data
 * nowhere else, so an unrecognised version now salvages rather than resets:
 *
 * - current version: read as-is
 * - older or newer version, or no version at all: keep the sessions that validate
 * - not an object, or unreadable: start empty
 *
 * A future envelope change that genuinely cannot be salvaged should add an explicit
 * upgrade step here rather than widening this fallback.
 */
export function migrateEnvelope(payload: unknown): StorageEnvelope {
  if (!payload || typeof payload !== "object") return emptyEnvelope();
  const record = payload as Record<string, unknown>;
  const sessions = Array.isArray(record.sessions) ? record.sessions.filter(isSession) : [];
  const dailyScores = Array.isArray(record.dailyScores)
    ? record.dailyScores.filter(isDailyScore)
    : summarizeDailyScores(sessions);
  return {
    ...record,
    version: STORAGE_VERSION,
    sessions,
    dailyScores,
    settings: migrateSettings(record.settings),
  };
}
