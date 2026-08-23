import assert from "node:assert/strict";
import test from "node:test";
import type { CompletedSession } from "./session-types.ts";
import type { SessionArchiveFile } from "../ports/session-archive-sink.ts";
import { createSessionArchiveFile, saveSessionArchive } from "./session-archive.ts";

const session: CompletedSession = {
  id: "session-1",
  mode: "60s",
  trainingSet: "japanese",
  startedAt: 1_000,
  endedAt: 61_000,
  prompts: [
    {
      promptId: "basic-1",
      startedAt: 1_000,
      input: "sensitive-typed-text",
      correctKeystrokes: 1,
      incorrectKeystrokes: 0,
    },
  ],
  keystrokes: [{ timestamp: 1_001, key: "s", normalizedKey: "s", correct: true, promptId: "basic-1", position: 0 }],
  metrics: { wpm: 42, cpm: 210, accuracy: 98.5, correctKeystrokes: 210, totalKeystrokes: 213, elapsedMs: 60_000 },
  score: 9_800,
  completedPrompts: 12,
  maxCombo: 64,
  weakKeys: [],
};

test("creates a versioned portable archive without changing session order", () => {
  const sourceWithFutureFields = {
    ...session,
    futureInternalField: "must not leak into v1",
    metrics: { ...session.metrics, futureMetric: 123 },
  };
  const file = createSessionArchiveFile([sourceWithFutureFields], Date.UTC(2026, 7, 18, 3, 4, 5));
  const archive = JSON.parse(file.content);

  assert.equal(file.filename, "typeloop-history-2026-08-18T03-04-05-000Z.json");
  assert.equal(file.mediaType, "application/json;charset=utf-8");
  assert.equal(archive.format, "typeloop-session-history");
  assert.equal(archive.version, 2);
  assert.equal(archive.exportedAt, "2026-08-18T03:04:05.000Z");
  assert.equal("prompts" in archive.sessions[0], false);
  assert.equal("keystrokes" in archive.sessions[0], false);
  assert.equal(file.content.includes("sensitive-typed-text"), false);
  assert.deepEqual(archive.sessions[0].metrics, session.metrics);
  assert.equal("futureInternalField" in archive.sessions[0], false);
  assert.equal("futureMetric" in archive.sessions[0].metrics, false);
  assert.equal(file.content.endsWith("\n"), true);
});

test("saves every session supplied by the repository, not only the visible history", async () => {
  const sessions = Array.from({ length: 50 }, (_, index) => ({ ...session, id: `session-${index}` }));
  let savedFile: SessionArchiveFile | undefined;

  await saveSessionArchive(
    { getAll: async () => sessions },
    { save: (file) => (savedFile = file) },
    Date.UTC(2026, 7, 18),
  );

  assert.equal(JSON.parse(savedFile?.content ?? "{}").sessions.length, 50);
});
