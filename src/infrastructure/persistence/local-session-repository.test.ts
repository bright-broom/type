import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { CompletedSession } from "../../application/session/session-types.ts";
import type { TrainingSet } from "../../domain/prompts/prompt-types.ts";
import { LocalSessionRepository } from "./local-session-repository.ts";

const STORAGE_KEY = "typeloop:data";

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

test("recovers from corrupt or incompatible persisted data", async () => {
  const storage = new MemoryStorage();
  const repository = new LocalSessionRepository();
  useStorage(storage);

  storage.values.set(STORAGE_KEY, "not-json");
  assert.deepEqual(await repository.getRecent(10), []);
  assert.deepEqual(await repository.getSettings(), { soundEnabled: true });

  storage.values.set(STORAGE_KEY, JSON.stringify({ version: 2, sessions: [session("old", 1)] }));
  assert.deepEqual(await repository.getRecent(10), []);
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

  await repository.saveSettings({ soundEnabled: false });
  assert.deepEqual(await repository.getSettings(), { soundEnabled: false });

  useStorage({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
  });
  await assert.doesNotReject(repository.save(session("safe", 1)));
  assert.deepEqual(await repository.getRecent(10), []);
});
