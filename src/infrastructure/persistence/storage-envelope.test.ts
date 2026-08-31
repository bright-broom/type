import assert from "node:assert/strict";
import test from "node:test";
import { emptyEnvelope, isSession, migrateEnvelope, normalizeSession, STORAGE_VERSION } from "./storage-envelope.ts";

function session(id: string, overrides: Record<string, unknown> = {}) {
  return { id, score: 1200, endedAt: 1_700_000_000_000, trainingSet: "japanese", ...overrides };
}

test("reads the current envelope unchanged", () => {
  const stored = {
    version: STORAGE_VERSION,
    sessions: [session("a"), session("b")],
    settings: { soundEnabled: false },
  };
  const envelope = migrateEnvelope(stored);
  assert.equal(envelope.version, STORAGE_VERSION);
  assert.deepEqual(
    envelope.sessions.map((entry) => entry.id),
    ["a", "b"],
  );
  assert.equal(envelope.settings.soundEnabled, false);
  assert.deepEqual(envelope.dailyScores, [{ dateKey: "2023-11-15", day: 15, bestScore: 1200, sessionCount: 2 }]);
});

test("an envelope from a newer build keeps its sessions instead of wiping them", () => {
  // This is the regression that mattered: the previous reader returned an empty
  // envelope for any version mismatch, deleting the only copy of a player's history.
  const fromFuture = {
    version: STORAGE_VERSION + 1,
    sessions: [session("a"), session("b")],
    settings: { soundEnabled: false },
    somethingNew: { streak: 4 },
  };
  const envelope = migrateEnvelope(fromFuture);
  assert.equal(envelope.sessions.length, 2);
  assert.equal(envelope.version, STORAGE_VERSION);
  assert.equal(envelope.settings.soundEnabled, false);
  assert.deepEqual(envelope.somethingNew, { streak: 4 });
});

test("derives daily summaries when upgrading an envelope that predates the calendar", () => {
  const endedAt = new Date(2026, 7, 12, 12).getTime();
  const envelope = migrateEnvelope({ sessions: [session("a", { endedAt, score: 900 })] });
  assert.deepEqual(envelope.dailyScores, [{ dateKey: "2026-08-12", day: 12, bestScore: 900, sessionCount: 1 }]);
});

test("a payload without a version is still read", () => {
  const envelope = migrateEnvelope({ sessions: [session("a")], settings: { soundEnabled: true } });
  assert.equal(envelope.sessions.length, 1);
});

test("sessions carrying unknown extra fields survive", () => {
  const envelope = migrateEnvelope({
    version: STORAGE_VERSION,
    sessions: [session("a", { streak: 3, mode: "120s", metrics: { wpm: 4, accuracy: 90, futureMetric: 7 } })],
  });
  assert.equal(envelope.sessions.length, 1);
  assert.equal(envelope.sessions[0]?.id, "a");
  assert.equal((envelope.sessions[0] as unknown as { mode: string }).mode, "120s");
  assert.equal((envelope.sessions[0]?.metrics as unknown as { futureMetric: number }).futureMetric, 7);
});

test("normalizes a salvageable partial session for safe rendering", () => {
  const normalized = normalizeSession(session("legacy"));
  assert.equal(normalized?.metricsAvailable, false);
  assert.deepEqual(normalized?.metrics, {
    wpm: 0,
    cpm: 0,
    accuracy: 0,
    correctKeystrokes: 0,
    totalKeystrokes: 0,
    elapsedMs: 0,
  });
  assert.deepEqual(normalized?.prompts, []);
  assert.deepEqual(normalized?.keystrokes, []);
});

test("only records missing the keys history depends on are dropped", () => {
  const envelope = migrateEnvelope({
    version: STORAGE_VERSION,
    sessions: [session("keep"), { id: "no-score" }, { score: 10, endedAt: 1 }, null, "nonsense"],
  });
  assert.deepEqual(
    envelope.sessions.map((entry) => entry.id),
    ["keep"],
  );
});

test("unusable payloads fall back to an empty envelope", () => {
  for (const payload of [null, undefined, 42, "string", []]) {
    const envelope = migrateEnvelope(payload);
    assert.deepEqual(envelope.sessions, [], JSON.stringify(payload));
  }
  assert.deepEqual(migrateEnvelope({ sessions: "not-an-array" }).sessions, []);
});

test("settings fall back per field rather than as a whole", () => {
  assert.equal(migrateEnvelope({ settings: { soundEnabled: "yes" } }).settings.soundEnabled, true);
  assert.equal(migrateEnvelope({ settings: {} }).settings.soundEnabled, true);
  assert.equal(migrateEnvelope({ settings: { soundEnabled: false } }).settings.soundEnabled, false);
  // A stored appearance is stale once the cookie owns it, so reading drops it.
  assert.deepEqual(
    migrateEnvelope({
      settings: {
        soundEnabled: false,
        appearance: { themeId: "classic", density: "compact", motion: "reduced" },
      },
    }).settings,
    { soundEnabled: false },
  );
});

test("an empty envelope is fresh each time so callers cannot share its arrays", () => {
  const first = emptyEnvelope();
  first.sessions.push(session("a") as never);
  assert.deepEqual(emptyEnvelope().sessions, []);
});

test("isSession guards the fields personal bests are computed from", () => {
  assert.equal(isSession(session("a")), true);
  assert.equal(isSession({ id: "a", score: 1, endedAt: "not-a-number" }), false);
  assert.equal(isSession({ id: "a", score: Number.NaN, endedAt: 1 }), false);
  assert.equal(isSession(undefined), false);
});
