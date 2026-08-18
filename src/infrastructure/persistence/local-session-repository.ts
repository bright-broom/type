import type { AppSettings, CompletedSession } from "../../application/session/session-types.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import type { SessionRepository } from "../../application/ports/session-repository.ts";
import { emptyEnvelope, migrateEnvelope, STORAGE_VERSION, type StorageEnvelope } from "./storage-envelope.ts";

const STORAGE_KEY = "typeloop:data";
const MAX_SESSIONS = 50;

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

function writeStorage(value: StorageEnvelope): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Persistence is best-effort. A full or disabled store must not stop play.
  }
}

export class LocalSessionRepository implements SessionRepository {
  async save(session: CompletedSession): Promise<void> {
    const data = readStorage();
    writeStorage({ ...data, version: STORAGE_VERSION, sessions: [session, ...data.sessions].slice(0, MAX_SESSIONS) });
  }

  async getRecent(limit: number): Promise<CompletedSession[]> {
    return readStorage().sessions.slice(0, Math.max(0, limit));
  }

  async getBest(trainingSet: TrainingSet = "japanese"): Promise<CompletedSession | null> {
    return readStorage()
      .sessions.filter((session) => (session.trainingSet ?? "japanese") === trainingSet)
      .reduce<CompletedSession | null>((best, session) => (!best || session.score > best.score ? session : best), null);
  }

  async getSettings(): Promise<AppSettings> {
    return readStorage().settings;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const data = readStorage();
    writeStorage({ ...data, version: STORAGE_VERSION, settings });
  }
}
