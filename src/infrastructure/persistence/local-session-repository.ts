import type { AppSettings } from "../../application/settings/app-settings.ts";
import type { CompletedSession } from "../../application/session/session-types.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import { addDailyScore, type DailyScore } from "../../domain/analytics/daily-score-calendar.ts";
import type { SessionRepository } from "../../application/ports/session-repository.ts";
import {
  emptyEnvelope,
  migrateEnvelope,
  normalizeSession,
  STORAGE_VERSION,
  type StorageEnvelope,
} from "./storage-envelope.ts";

export const STORAGE_KEY = "typeloop:data";
export const MAX_STORED_SESSIONS = 50;
export const MAX_DAILY_SCORE_DAYS = 3_660;

function readStorage(): StorageEnvelope {
  if (typeof window === "undefined") return emptyEnvelope();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyEnvelope();
    return migrateEnvelope(JSON.parse(raw));
  } catch {
    return emptyEnvelope();
  }
}

function writeStorage(value: StorageEnvelope): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    // Persistence is best-effort. A full or disabled store must not stop play.
    return false;
  }
}

export class LocalSessionRepository implements SessionRepository {
  async save(session: CompletedSession): Promise<boolean> {
    const data = readStorage();
    return writeStorage({
      ...data,
      version: STORAGE_VERSION,
      sessions: [session, ...data.sessions].slice(0, MAX_STORED_SESSIONS),
      dailyScores: addDailyScore(data.dailyScores, session).slice(0, MAX_DAILY_SCORE_DAYS),
    });
  }

  async getDailyScores(): Promise<DailyScore[]> {
    return readStorage().dailyScores;
  }

  async getAll(): Promise<CompletedSession[]> {
    return readStorage()
      .sessions.map(normalizeSession)
      .filter((session): session is CompletedSession => session !== null);
  }

  async getRecent(limit: number): Promise<CompletedSession[]> {
    return (await this.getAll()).slice(0, Math.max(0, limit));
  }

  async getBest(trainingSet: TrainingSet = "japanese"): Promise<CompletedSession | null> {
    const best = readStorage()
      .sessions.filter((session) => (session.trainingSet ?? "japanese") === trainingSet)
      .reduce<CompletedSession | null>(
        (current, session) => (!current || session.score > current.score ? session : current),
        null,
      );
    return normalizeSession(best);
  }

  async getSettings(): Promise<AppSettings> {
    return readStorage().settings;
  }

  async saveSettings(settings: AppSettings): Promise<boolean> {
    const data = readStorage();
    return writeStorage({ ...data, version: STORAGE_VERSION, settings: { ...data.settings, ...settings } });
  }
}
