import type { AppSettings, CompletedSession } from "../../application/session/session-types.ts";
import type { SessionRepository } from "./session-repository.ts";

const STORAGE_KEY = "typeloop:data";
const MAX_SESSIONS = 50;
const DEFAULT_SETTINGS: AppSettings = { soundEnabled: true };

type StorageEnvelope = {
  version: 1;
  sessions: CompletedSession[];
  settings: AppSettings;
};

const EMPTY: StorageEnvelope = { version: 1, sessions: [], settings: DEFAULT_SETTINGS };

function isSession(value: unknown): value is CompletedSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.score === "number" && typeof record.endedAt === "number";
}

function readStorage(): StorageEnvelope {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<StorageEnvelope>;
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) return EMPTY;
    return {
      version: 1,
      sessions: parsed.sessions.filter(isSession),
      settings: {
        soundEnabled: parsed.settings?.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
      },
    };
  } catch {
    return EMPTY;
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
    writeStorage({ ...data, sessions: [session, ...data.sessions].slice(0, MAX_SESSIONS) });
  }

  async getRecent(limit: number): Promise<CompletedSession[]> {
    return readStorage().sessions.slice(0, Math.max(0, limit));
  }

  async getBest(): Promise<CompletedSession | null> {
    return readStorage().sessions.reduce<CompletedSession | null>(
      (best, session) => (!best || session.score > best.score ? session : best),
      null,
    );
  }

  async getSettings(): Promise<AppSettings> {
    return readStorage().settings;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const data = readStorage();
    writeStorage({ ...data, settings });
  }
}
