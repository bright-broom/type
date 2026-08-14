import type { AppSettings, CompletedSession, TrainingSet } from "../../application/session/session-types.ts";

export interface SessionRepository {
  save(session: CompletedSession): Promise<void>;
  getRecent(limit: number): Promise<CompletedSession[]>;
  getBest(trainingSet?: TrainingSet): Promise<CompletedSession | null>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
}
