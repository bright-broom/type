import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { CompletedSession } from "../../application/session/session-types.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import { LocalSessionRepository, MAX_STORED_SESSIONS, STORAGE_KEY } from "./local-session-repository.ts";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function session(id: string, score: number, trainingSet: TrainingSet = "japanese"): CompletedSession {
  return {
    id,
    mode: "60s",
    trainingSet,
    startedAt: 0,
    endedAt: Number(id.replace(/\D/g, "")) || 1,
    prompts: [],
    keystrokes: [],
    metrics: { wpm: 0, cpm: 0, accuracy: 100, correctKeystrokes: 0, totalKeystrokes: 0, elapsedMs: 60_000 },
    score,
    completedPrompts: 0,
    maxCombo: 0,
    weakKeys: [],
  };
}

function useStorage(storage: Pick<Storage, "getItem" | "setItem">) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

test("recovers from corrupt persisted data", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalSessionRepository();
  useStorage(storage);

  storage.values.set(STORAGE_KEY, "not-json");
  assert.deepEqual(await repository.getRecent(10), []);
  assert.deepEqual(await repository.getSettings(), { soundEnabled: true });
});

test("history written by a different envelope version is kept, not discarded", async () => {
  // This assertion used to be the opposite: any version mismatch reset the entry,
  // which would have deleted every player's history on the first envelope change.
  const storage = new MemoryStorage();
  const repository = new LocalSessionRepository();
  useStorage(storage);

  storage.values.set(STORAGE_KEY, JSON.stringify({ version: 2, sessions: [session("old", 1)] }));
  const recovered = await repository.getRecent(10);
  assert.deepEqual(
    recovered.map((entry) => entry.id),
    ["old"],
  );
});

test("caps history and keeps best scores isolated by training set", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalSessionRepository();
  useStorage(storage);

  for (let index = 0; index < 52; index += 1) await repository.save(session(`jp-${index}`, index));
  await repository.save(session("consulting-1", 900, "consulting"));
  await repository.save(session("takken-1", 800, "takken"));

  assert.equal((await repository.getRecent(100)).length, 50);
  assert.equal((await repository.getAll()).length, 50);
  assert.equal((await repository.getBest("japanese"))?.score, 51);
  assert.equal((await repository.getBest("consulting"))?.score, 900);
  assert.equal((await repository.getBest("takken"))?.score, 800);
  assert.deepEqual(await repository.getRecent(-1), []);
});

test("persists settings and treats unavailable storage as non-fatal", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalSessionRepository();
  useStorage(storage);

  const settings = { soundEnabled: false };
  await repository.saveSettings(settings);
  assert.deepEqual(await repository.getSettings(), settings);

  useStorage({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
  });
  assert.equal(await repository.save(session("safe", 1)), false);
  assert.deepEqual(await repository.getRecent(10), []);
});

test("display normalization never overwrites unknown persisted session fields", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalSessionRepository();
  useStorage(storage);
  const futureSession = session("future", 700) as CompletedSession & { futureField: string };
  futureSession.mode = "120s" as "60s";
  futureSession.futureField = "keep";
  futureSession.metrics = { ...futureSession.metrics, futureMetric: 7 } as CompletedSession["metrics"];
  storage.values.set(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      sessions: [futureSession, { id: "partial", score: 10, endedAt: 20 }],
      settings: { soundEnabled: true },
    }),
  );

  const displaySession = (await repository.getAll())[0];
  assert.equal(displaySession?.metrics.wpm, 0);
  await repository.saveSettings({ soundEnabled: false });

  const persisted = JSON.parse(storage.values.get(STORAGE_KEY) ?? "{}") as {
    sessions: Array<{ mode?: string; futureField?: string; metrics?: { futureMetric: number } }>;
  };
  assert.equal(persisted.sessions[0]?.mode, "120s");
  assert.equal(persisted.sessions[0]?.futureField, "keep");
  assert.equal(persisted.sessions[0]?.metrics?.futureMetric, 7);
  assert.equal("metrics" in (persisted.sessions[1] ?? {}), false);
});

test("daily summaries outlive the capped detailed session list", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalSessionRepository();
  useStorage(storage);
  const firstEndedAt = new Date(2025, 0, 1, 12).getTime();

  for (let index = 0; index <= MAX_STORED_SESSIONS; index += 1) {
    const entry = session(`daily-${index}`, index);
    entry.endedAt = new Date(2025, 0, index + 1, 12).getTime();
    await repository.save(entry);
  }

  assert.equal(
    (await repository.getAll()).some((entry) => entry.endedAt === firstEndedAt),
    false,
  );
  assert.equal(
    (await repository.getDailyScores()).some((score) => score.dateKey === "2025-01-01"),
    true,
  );
});

test("saving settings preserves fields written by a newer envelope", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalSessionRepository();
  useStorage(storage);
  storage.values.set(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      sessions: [],
      dailyScores: [],
      settings: { soundEnabled: true, futureSetting: "keep" },
      futureEnvelope: { streak: 4 },
    }),
  );

  await repository.saveSettings({ soundEnabled: false });
  const persisted = JSON.parse(storage.values.get(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
  assert.deepEqual(persisted.futureEnvelope, { streak: 4 });
  assert.deepEqual(persisted.settings, { soundEnabled: false, futureSetting: "keep" });
});
