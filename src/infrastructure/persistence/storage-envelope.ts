import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from "../../application/settings/app-settings.ts";
import type { CompletedSession } from "../../application/session/session-types.ts";
import { isTrainingSet } from "../../domain/prompts/prompt-types.ts";

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
  settings: AppSettings;
};

export const STORAGE_VERSION = 1;

export function emptyEnvelope(): StorageEnvelope {
  return {
    version: STORAGE_VERSION,
    sessions: [],
    settings: { ...DEFAULT_APP_SETTINGS },
  };
}

/**
 * A record is usable only when every field consumed by history, personal bests,
 * and archive export is present. Unknown fields remain harmless, while a corrupt
 * record is removed independently so its valid neighbours still survive.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidDateNumber(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isFinite(new Date(value).getTime());
}

function isCount(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPromptAttempt(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.promptId === "string" &&
    value.promptId.length > 0 &&
    isFiniteNumber(value.startedAt) &&
    (value.completedAt === undefined || isFiniteNumber(value.completedAt)) &&
    typeof value.input === "string" &&
    isCount(value.correctKeystrokes) &&
    isCount(value.incorrectKeystrokes)
  );
}

function isKeystroke(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.timestamp) &&
    typeof value.key === "string" &&
    typeof value.normalizedKey === "string" &&
    typeof value.correct === "boolean" &&
    typeof value.promptId === "string" &&
    value.promptId.length > 0 &&
    isCount(value.position)
  );
}

function isMetrics(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isCount(value.correctKeystrokes) &&
    isCount(value.totalKeystrokes) &&
    value.correctKeystrokes <= value.totalKeystrokes &&
    isFiniteNumber(value.accuracy) &&
    value.accuracy >= 0 &&
    value.accuracy <= 100 &&
    isFiniteNumber(value.wpm) &&
    value.wpm >= 0 &&
    isFiniteNumber(value.cpm) &&
    value.cpm >= 0 &&
    isFiniteNumber(value.elapsedMs) &&
    value.elapsedMs >= 0
  );
}

function isWeakKey(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === "string" &&
    value.key.length > 0 &&
    isCount(value.total) &&
    isCount(value.correct) &&
    isCount(value.incorrect) &&
    value.correct + value.incorrect === value.total &&
    isFiniteNumber(value.accuracy) &&
    value.accuracy >= 0 &&
    value.accuracy <= 100
  );
}

export function isSession(value: unknown): value is CompletedSession {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.mode === "60s" &&
    (value.trainingSet === undefined || isTrainingSet(value.trainingSet)) &&
    isValidDateNumber(value.startedAt) &&
    isValidDateNumber(value.endedAt) &&
    value.endedAt >= value.startedAt &&
    Array.isArray(value.prompts) &&
    value.prompts.every(isPromptAttempt) &&
    Array.isArray(value.keystrokes) &&
    value.keystrokes.every(isKeystroke) &&
    isMetrics(value.metrics) &&
    isFiniteNumber(value.score) &&
    value.score >= 0 &&
    isCount(value.completedPrompts) &&
    isCount(value.maxCombo) &&
    Array.isArray(value.weakKeys) &&
    value.weakKeys.every(isWeakKey)
  );
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
  return {
    version: STORAGE_VERSION,
    sessions,
    settings: normalizeAppSettings(record.settings),
  };
}
