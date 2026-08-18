import type { AppSettings, CompletedSession } from "../../application/session/session-types.ts";

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

export const DEFAULT_SETTINGS: AppSettings = { soundEnabled: true };

export function emptyEnvelope(): StorageEnvelope {
  return { version: STORAGE_VERSION, sessions: [], settings: { ...DEFAULT_SETTINGS } };
}

/**
 * A record is usable when the fields history and personal bests are keyed on are
 * present. Everything else is optional on purpose: a session written by an older
 * build stays playable in the history list instead of being thrown away.
 */
export function isSession(value: unknown): value is CompletedSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.score === "number" && typeof record.endedAt === "number";
}

function readSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };
  const record = value as Record<string, unknown>;
  return {
    soundEnabled: typeof record.soundEnabled === "boolean" ? record.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
  };
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
    settings: readSettings(record.settings),
  };
}
