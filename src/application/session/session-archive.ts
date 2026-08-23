import type { SessionArchiveFile, SessionArchiveSink } from "../ports/session-archive-sink.ts";
import type { SessionRepository } from "../ports/session-repository.ts";
import type { CompletedSession } from "./session-types.ts";

const ARCHIVE_FORMAT = "typeloop-session-history";
const ARCHIVE_VERSION = 2;

type SessionArchive = {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  exportedAt: string;
  sessions: ReadonlyArray<SessionArchiveEntryV2>;
};

type SessionArchiveEntryV2 = {
  id: string;
  mode: "60s";
  trainingSet: string;
  startedAt: number;
  endedAt: number;
  metrics: {
    correctKeystrokes: number;
    totalKeystrokes: number;
    accuracy: number;
    wpm: number;
    cpm: number;
    elapsedMs: number;
  };
  score: number;
  completedPrompts: number;
  maxCombo: number;
  weakKeys: Array<{
    key: string;
    total: number;
    correct: number;
    incorrect: number;
    accuracy: number;
  }>;
};

function toArchiveEntryV2(session: CompletedSession): SessionArchiveEntryV2 {
  return {
    id: session.id,
    mode: session.mode,
    trainingSet: session.trainingSet ?? "japanese",
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    metrics: {
      correctKeystrokes: session.metrics.correctKeystrokes,
      totalKeystrokes: session.metrics.totalKeystrokes,
      accuracy: session.metrics.accuracy,
      wpm: session.metrics.wpm,
      cpm: session.metrics.cpm,
      elapsedMs: session.metrics.elapsedMs,
    },
    score: session.score,
    completedPrompts: session.completedPrompts,
    maxCombo: session.maxCombo,
    weakKeys: session.weakKeys.map((performance) => ({
      key: performance.key,
      total: performance.total,
      correct: performance.correct,
      incorrect: performance.incorrect,
      accuracy: performance.accuracy,
    })),
  };
}

export function createSessionArchiveFile(
  sessions: ReadonlyArray<CompletedSession>,
  exportedAt: number,
): SessionArchiveFile {
  const timestamp = new Date(exportedAt).toISOString();
  const archive: SessionArchive = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: timestamp,
    sessions: sessions.map(toArchiveEntryV2),
  };

  return {
    filename: `typeloop-history-${timestamp.replace(/[:.]/g, "-")}.json`,
    mediaType: "application/json;charset=utf-8",
    content: `${JSON.stringify(archive, null, 2)}\n`,
  };
}

export async function saveSessionArchive(
  repository: Pick<SessionRepository, "getAll">,
  sink: SessionArchiveSink,
  exportedAt: number,
): Promise<void> {
  const sessions = await repository.getAll();
  sink.save(createSessionArchiveFile(sessions, exportedAt));
}
