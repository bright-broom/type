import type { AppSettings } from "../settings/app-settings.ts";
import type { CompletedSession } from "../session/session-types.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import type { DailyScore } from "../../domain/analytics/daily-score-calendar.ts";

export interface SessionRepository {
  save(session: CompletedSession): Promise<boolean>;
  getAll(): Promise<CompletedSession[]>;
  getDailyScores(): Promise<DailyScore[]>;
  getRecent(limit: number): Promise<CompletedSession[]>;
  getBest(trainingSet?: TrainingSet): Promise<CompletedSession | null>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<boolean>;
}
