import type { AppSettings, CompletedSession } from "../session/session-types.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";

export interface SessionRepository {
  save(session: CompletedSession): Promise<void>;
  getRecent(limit: number): Promise<CompletedSession[]>;
  getBest(trainingSet?: TrainingSet): Promise<CompletedSession | null>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
}
