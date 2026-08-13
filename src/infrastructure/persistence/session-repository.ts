import type { AppSettings, CompletedSession } from "../../application/session/session-types.ts";

export interface SessionRepository {
  save(session: CompletedSession): Promise<void>;
  getRecent(limit: number): Promise<CompletedSession[]>;
  getBest(trainingSet?: "japanese" | "consulting"): Promise<CompletedSession | null>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
}
